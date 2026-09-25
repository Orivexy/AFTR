import "server-only";
import type { DiscoverySource, Prisma, VenueType } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { parseDurationMinutes } from "@/lib/duration";
import { buildSearchText, slugify } from "@/lib/text";
import { randomBytes } from "node:crypto";
import { CONNECTORS } from "./connectors";
import { detectGenres, normalizeEvent, safeUrl, stripHtml } from "./normalize";
import { isExpired, qualityIssues } from "./validate";
import { POSSIBLE_DUPLICATE_THRESHOLD } from "./dedupe";
import {
  applySourceUpdate, attachVenue, contentHash, createEventFromNormalized, ensureTaxonomy, findBestMatch, loadCityVenues, matchVenue,
  type VenueCandidate,
} from "./store";
import type { ExternalVenue, NormalizedVenue, SourceContext } from "./types";

/**
 * FUENTES → DISCOVERY ENGINE → NORMALIZACIÓN → DEDUPLICACIÓN → VALIDACIÓN → BD → FRONTEND
 *
 * syncSource() runs one source end-to-end; runDueSources() is called by the
 * scheduler (in-process job or /api/cron/event-discovery). A DB lease makes
 * sure the same source never syncs twice at the same time.
 */

const LOCK_MINUTES = 15;
const DEFAULT_INTERVAL = () => parseDurationMinutes(env.EVENT_SYNC_INTERVAL, 30);

export function intervalMinutes(source: Pick<DiscoverySource, "syncIntervalMin">) {
  return Math.max(5, source.syncIntervalMin ?? DEFAULT_INTERVAL());
}

interface Counters {
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  queued: number;
  skipped: number;
  deactivated: number;
  errors: number;
}

async function claim(sourceId: string, now: Date) {
  const { count } = await db.discoverySource.updateMany({
    where: { id: sourceId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { status: "RUNNING", lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) },
  });
  return count === 1;
}

export async function syncSource(sourceId: string): Promise<{ skipped: true } | { runId: string; counters: Counters; error?: string }> {
  const startedAt = new Date();
  if (!(await claim(sourceId, startedAt))) return { skipped: true };

  const source = await db.discoverySource.findUniqueOrThrow({ where: { id: sourceId }, include: { city: { include: { country: true } } } });
  const run = await db.syncRun.create({ data: { sourceId, status: "RUNNING" } });
  const lines: string[] = [];
  const log = (l: string) => lines.length < 200 && lines.push(l);
  const c: Counters = { found: 0, created: 0, updated: 0, unchanged: 0, duplicates: 0, queued: 0, skipped: 0, deactivated: 0, errors: 0 };
  const city = {
    id: source.city.id, name: source.city.name, lat: source.city.lat, lng: source.city.lng, timezone: source.city.timezone,
    searchRadiusKm: source.city.searchRadiusKm, countryCode: source.city.country.code, currency: source.city.country.currency,
  };
  const ctx: SourceContext = { sourceId, url: source.url, config: (source.config as Record<string, unknown>) ?? {}, city, log };
  const connector = CONNECTORS[source.type];
  let error: string | undefined;

  try {
    await ensureTaxonomy();
    const venues = await loadCityVenues(city.id);

    if (connector.fetchVenues) {
      const items = await connector.fetchVenues(ctx);
      log(`${items.length} locales recibidos`);
      for (const item of items) {
        try {
          await processVenue(item, source, venues, connector.retentionDays);
        } catch (err) {
          c.errors++;
          log(`Local ${item.name}: ${(err as Error).message}`);
        }
      }
    }

    if (connector.fetchEvents) {
      const items = await connector.fetchEvents(ctx);
      c.found = items.length;
      const cityVenues = await loadCityVenues(city.id); // may include venues linked above
      for (const item of items) {
        try {
          await processEvent(item, source, city, cityVenues, c, log);
        } catch (err) {
          c.errors++;
          log(`${item.title}: ${(err as Error).message}`);
        }
      }
      // Hide events the source stopped listing — only after a healthy run.
      const healthy = c.found > 0 || source.eventsFound === 0;
      if (source.deactivateMissing && healthy) c.deactivated = await deactivateMissing(source.id, startedAt);
      if (!healthy) log("La fuente no devolvió eventos: no se desactiva nada por precaución");
    }
  } catch (err) {
    error = (err as Error).message.slice(0, 500);
    log(`ERROR: ${error}`);
  }

  const finishedAt = new Date();
  const interval = intervalMinutes(source);
  await db.$transaction([
    db.syncRun.update({ where: { id: run.id }, data: { ...c, status: error ? "ERROR" : "OK", finishedAt, log: lines.join("\n") } }),
    db.discoverySource.update({
      where: { id: sourceId },
      data: {
        status: error ? "ERROR" : "OK",
        lastError: error ?? null,
        lastSyncAt: finishedAt,
        // Back off on errors so a broken source isn't hammered.
        nextSyncAt: new Date(finishedAt.getTime() + (error ? Math.min(interval * 4, 360) : interval) * 60_000),
        lockedUntil: null,
        ...(error ? {} : { eventsFound: c.found }),
      },
    }),
  ]);
  return { runId: run.id, counters: c, error };
}

async function processEvent(
  item: Parameters<typeof normalizeEvent>[0],
  source: DiscoverySource,
  city: { id: string; name: string; lat: number; lng: number; timezone: string; searchRadiusKm: number; currency: string },
  venues: VenueCandidate[],
  c: Counters,
  log: (l: string) => void,
) {
  const now = new Date();
  const existing = await db.sourceEventRecord.findUnique({ where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId.slice(0, 300) } } });
  const touch = () => existing && db.sourceEventRecord.update({ where: { id: existing.id }, data: { lastSeenAt: now, missedSyncs: 0 } });

  const res = normalizeEvent(item, city.timezone);
  if (!res.ok) {
    c.skipped++;
    log(`Omitido «${item.title}»: ${res.reason}`);
    await touch();
    return;
  }
  const n = attachVenue(res.event, venues);
  if (isExpired(n, now)) {
    c.skipped++;
    await touch();
    return;
  }
  const hash = contentHash(n);
  const recordData = { data: n as unknown as Prisma.InputJsonValue, contentHash: hash, sourceUrl: n.sourceUrl, lastSeenAt: now, lastSyncedAt: now, missedSyncs: 0 };

  // Already linked to an event → update it.
  if (existing?.eventId) {
    if (existing.contentHash === hash) {
      c.unchanged++;
      await touch();
      return;
    }
    const { changed } = await applySourceUpdate(existing.eventId, n, source, city.name);
    await db.sourceEventRecord.update({ where: { id: existing.id }, data: recordData });
    if (changed) c.updated++;
    else c.unchanged++;
    return;
  }
  if (existing?.reviewStatus === "REJECTED") {
    await db.sourceEventRecord.update({ where: { id: existing.id }, data: recordData });
    c.skipped++;
    return;
  }
  if (n.cancelled) {
    c.skipped++;
    return;
  }

  // Same party from another source? Link instead of creating a copy.
  const match = await findBestMatch(n, city.id);
  if (match && match.score >= 0.75) {
    await applySourceUpdate(match.id, n, source, city.name);
    await upsertRecord(source.id, item.externalId, { ...recordData, eventId: match.id, reviewStatus: "AUTO", reviewReasons: [], matchScore: match.score, duplicateOfId: null });
    c.duplicates++;
    log(`Duplicado de «${match.title}» (${match.reasons.join(", ")})`);
    return;
  }

  const issues = qualityIssues(n, { now, city });
  let duplicateOfId: string | null = null;
  if (match && match.score >= POSSIBLE_DUPLICATE_THRESHOLD) {
    issues.push(`Posible duplicado de «${match.title}»`);
    duplicateOfId = match.id;
  }
  if (!source.autoPublish) issues.push("Fuente con revisión manual");

  if (issues.length) {
    await upsertRecord(source.id, item.externalId, { ...recordData, eventId: null, reviewStatus: "PENDING", reviewReasons: issues, duplicateOfId, matchScore: match?.score ?? null });
    if (!existing) c.queued++;
    return;
  }

  const event = await createEventFromNormalized(n, source, city);
  await upsertRecord(source.id, item.externalId, { ...recordData, eventId: event.id, reviewStatus: "AUTO", reviewReasons: [], duplicateOfId: null, matchScore: null });
  c.created++;
}

async function upsertRecord(sourceId: string, externalId: string, data: Omit<Prisma.SourceEventRecordUncheckedCreateInput, "sourceId" | "externalId">) {
  const id = externalId.slice(0, 300);
  await db.sourceEventRecord.upsert({
    where: { sourceId_externalId: { sourceId, externalId: id } },
    create: { sourceId, externalId: id, ...data },
    update: data,
  });
}

async function deactivateMissing(sourceId: string, runStart: Date): Promise<number> {
  await db.sourceEventRecord.updateMany({ where: { sourceId, lastSeenAt: { lt: runStart } }, data: { missedSyncs: { increment: 1 } } });
  // Two consecutive misses → the source no longer lists it.
  const gone = await db.sourceEventRecord.findMany({
    where: {
      sourceId,
      missedSyncs: { gte: 2 },
      event: { primarySourceId: sourceId, status: "PUBLISHED", startsAt: { gt: new Date() }, source: "IMPORT", trust: { not: "VERIFIED" } },
    },
    select: { eventId: true },
  });
  for (const g of gone) {
    await db.$transaction([
      db.event.update({ where: { id: g.eventId! }, data: { status: "INACTIVE" } }),
      db.eventChange.create({ data: { eventId: g.eventId!, sourceId, field: "status", oldValue: "PUBLISHED", newValue: "INACTIVE" } }),
    ]);
  }
  return gone.length;
}

// ─── Venues ──────────────────────────────────────────────────────────────────

function venueType(types: string[] = []): VenueType {
  const t = types.map((x) => x.toLowerCase()).join(" ");
  if (/night_?club|nightclub|discoteca/.test(t)) return "CLUB";
  if (/bar|pub/.test(t)) return "BAR";
  if (/concert|music_?venue|musicvenue|sala/.test(t)) return "CONCERT_HALL";
  return "CLUB";
}

export function normalizeVenue(v: ExternalVenue): NormalizedVenue {
  const insta = v.instagram?.match(/instagram\.com\/([A-Za-z0-9_.]+)/)?.[1] ?? v.instagram?.replace(/^@/, "") ?? null;
  return {
    name: v.name.trim().slice(0, 80),
    address: v.address?.trim().slice(0, 160) || null,
    lat: typeof v.lat === "number" && Number.isFinite(v.lat) ? v.lat : null,
    lng: typeof v.lng === "number" && Number.isFinite(v.lng) ? v.lng : null,
    phone: v.phone?.trim().slice(0, 40) || null,
    website: safeUrl(v.website),
    instagram: insta && /^[A-Za-z0-9_.]{1,30}$/.test(insta) ? `@${insta}` : null,
    description: stripHtml(v.description),
    genres: detectGenres(v.genres ?? [], ""),
    type: venueType(v.types),
    openingHours: v.openingHours ?? null,
    googlePlaceId: v.googlePlaceId ?? null,
    sourceUrl: safeUrl(v.sourceUrl),
    imageUrls: (v.imageUrls ?? []).map(safeUrl).filter((u): u is string => Boolean(u)).slice(0, 3),
  };
}

async function processVenue(item: ExternalVenue, source: DiscoverySource, venues: VenueCandidate[], retentionDays?: number) {
  const n = normalizeVenue(item);
  const now = new Date();
  const expiresAt = retentionDays ? new Date(now.getTime() + retentionDays * 86400_000) : null;
  const byPlaceId = n.googlePlaceId ? await db.venue.findUnique({ where: { googlePlaceId: n.googlePlaceId }, select: { id: true } }) : null;
  const matched = byPlaceId ?? matchVenue(venues, n.name, n.lat, n.lng);
  const base = { data: n as unknown as Prisma.InputJsonValue, contentHash: contentHash(n), lastSeenAt: now, expiresAt };
  const key = { sourceId_externalId: { sourceId: source.id, externalId: item.externalId.slice(0, 300) } };

  if (matched) {
    const current = await db.venue.findUniqueOrThrow({ where: { id: matched.id }, select: { phone: true, website: true, instagram: true, googlePlaceId: true, openingHours: true, description: true } });
    const official = source.trust === "OFFICIAL" && source.venueId === matched.id;
    const pick = <T,>(incoming: T | null, cur: T | null) => (incoming != null && (official || cur == null) ? incoming : undefined);
    await db.venue.update({
      where: { id: matched.id },
      data: {
        phone: pick(n.phone, current.phone),
        website: pick(n.website, current.website),
        instagram: pick(n.instagram, current.instagram),
        googlePlaceId: current.googlePlaceId ? undefined : (n.googlePlaceId ?? undefined),
        openingHours: pick(n.openingHours, current.openingHours as never) ?? undefined,
        description: pick(n.description, current.description),
        lastSyncedAt: now,
        ...(official ? { trust: "OFFICIAL" as const } : {}),
      },
    });
    await db.sourceVenueRecord.upsert({ where: key, create: { sourceId: source.id, externalId: key.sourceId_externalId.externalId, ...base, venueId: matched.id, reviewStatus: "AUTO", reviewReasons: [] }, update: { ...base, venueId: matched.id } });
    return;
  }

  const existing = await db.sourceVenueRecord.findUnique({ where: key });
  if (existing?.reviewStatus === "REJECTED") {
    await db.sourceVenueRecord.update({ where: key, data: base });
    return;
  }
  const reasons = ["Local nuevo"];
  if (n.lat == null || n.lng == null) reasons.push("Sin coordenadas");
  if (source.trust === "OFFICIAL" && source.autoPublish && n.lat != null && n.address) {
    const venue = await createVenueFromNormalized(n, source.cityId, "OFFICIAL");
    await db.sourceVenueRecord.upsert({ where: key, create: { sourceId: source.id, externalId: key.sourceId_externalId.externalId, ...base, venueId: venue.id, reviewStatus: "AUTO", reviewReasons: [] }, update: { ...base, venueId: venue.id } });
    return;
  }
  await db.sourceVenueRecord.upsert({ where: key, create: { sourceId: source.id, externalId: key.sourceId_externalId.externalId, ...base, reviewStatus: "PENDING", reviewReasons: reasons }, update: { ...base, reviewReasons: reasons } });
}

export async function createVenueFromNormalized(n: NormalizedVenue, cityId: string, trust: "IMPORTED" | "OFFICIAL") {
  if (n.lat == null || n.lng == null || !n.address) throw new Error("El local necesita dirección y coordenadas");
  const [city, genres] = await Promise.all([
    db.city.findUniqueOrThrow({ where: { id: cityId }, select: { name: true } }),
    db.musicGenre.findMany({ where: { slug: { in: n.genres } }, select: { id: true } }),
  ]);
  const now = new Date();
  return db.venue.create({
    data: {
      slug: `${slugify(n.name) || "local"}-${randomBytes(2).toString("hex")}`,
      name: n.name,
      type: n.type,
      description: n.description,
      cityId,
      address: n.address,
      lat: n.lat,
      lng: n.lng,
      phone: n.phone,
      website: n.website,
      instagram: n.instagram,
      googlePlaceId: n.googlePlaceId,
      openingHours: n.openingHours ?? undefined,
      trust,
      importedAt: now,
      lastSyncedAt: now,
      searchText: buildSearchText(n.name, n.address, city.name),
      genres: { create: genres.map((g) => ({ genreId: g.id })) },
    },
    select: { id: true, slug: true },
  });
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

let running = false;

/** Syncs every enabled source whose next sync time has come (sequentially). */
export async function runDueSources(now = new Date()) {
  if (!env.DISCOVERY_ENABLED || running) return { ran: 0 };
  running = true;
  try {
    const due = await db.discoverySource.findMany({
      where: { enabled: true, OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] },
      select: { id: true },
      orderBy: { nextSyncAt: "asc" },
      take: 10,
    });
    for (const s of due) await syncSource(s.id);
    return { ran: due.length };
  } finally {
    running = false;
  }
}

/** Purges data from sources with caching limits (e.g. Google Places after 30 days). */
export async function purgeExpiredSourceData(now = new Date()) {
  const { count: removed } = await db.sourceVenueRecord.deleteMany({ where: { expiresAt: { lt: now }, venueId: null } });
  const { count: cleared } = await db.sourceVenueRecord.updateMany({ where: { expiresAt: { lt: now }, venueId: { not: null } }, data: { data: {}, expiresAt: null } });
  return { removed, cleared };
}

import "server-only";
import { getSettings } from "../settings";
import type { DiscoverySource, Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { parseDurationMinutes } from "@/lib/duration";
import { CONNECTORS } from "./connectors";
import { detectGenres, normalizeEvent, safeUrl, stripHtml } from "./normalize";
import { isExpired, qualityIssues } from "./validate";
import { POSSIBLE_DUPLICATE_THRESHOLD } from "./dedupe";
import {
  applySourceUpdate, attachVenue, contentHash, createEventFromNormalized, ensureTaxonomy, findBestMatch, loadCityVenues,
  type VenueCandidate,
  isNightlifeEvent,
  fillMissingCover,
  fillMissingVenueCover,
} from "./store";
import type { ExternalVenue, NormalizedVenue, SourceContext } from "./types";
import { ALL_PLACE_CATEGORIES, NIGHTLIFE_CATEGORIES, type NightlifeCategory, type ProviderPlace } from "../places/types";
import { OWN_SOURCE_POLICY, linkEventsToVenues, refreshHours, syncPlaces } from "../places/sync";
import { backoffMinutes } from "../places/rules";

/**
 * FUENTES → DISCOVERY ENGINE → NORMALIZACIÓN → DEDUPLICACIÓN → VALIDACIÓN → BD → FRONTEND
 *
 * syncSource() runs one source end-to-end; runDueSources() is called by the
 * scheduler (in-process job or /api/cron/event-discovery). A DB lease makes
 * sure the same source never syncs twice at the same time.
 */

const LOCK_MINUTES = 15;

/** Sources that provide places (venues) vs. events. */
export function sourceKind(type: DiscoverySource["type"]): "venues" | "events" {
  const c = CONNECTORS[type];
  return c.placeProvider || c.syncVenues || (c.fetchVenues && !c.fetchEvents) ? "venues" : "events";
}

export function intervalMinutes(source: Pick<DiscoverySource, "syncIntervalMin" | "type">) {
  const fallback = sourceKind(source.type) === "venues" ? parseDurationMinutes(env.VENUE_SYNC_INTERVAL, 24 * 60) : parseDurationMinutes(env.EVENT_SYNC_INTERVAL, 30);
  return Math.max(5, source.syncIntervalMin ?? fallback);
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

export type SyncMode = "full" | "hours";

export async function syncSource(sourceId: string, opts: { mode?: SyncMode; job?: string } = {}): Promise<{ skipped: true; reason?: string } | { runId: string; counters: Counters; error?: string }> {
  const mode = opts.mode ?? "full";
  const startedAt = new Date();
  const pending = await db.discoverySource.findUnique({ where: { id: sourceId }, select: { type: true } });
  const missing = pending && CONNECTORS[pending.type].missingConfig?.();
  if (missing) return { skipped: true, reason: missing };
  if (!(await claim(sourceId, startedAt))) return { skipped: true };

  const source = await db.discoverySource.findUniqueOrThrow({ where: { id: sourceId }, include: { city: { include: { country: true } } } });
  const run = await db.syncRun.create({ data: { sourceId, status: "RUNNING", job: opts.job } });
  const lines: string[] = [];
  const log = (l: string) => lines.length < 200 && lines.push(l);
  const c: Counters = { found: 0, created: 0, updated: 0, unchanged: 0, duplicates: 0, queued: 0, skipped: 0, deactivated: 0, errors: 0 };
  const city = {
    id: source.city.id, name: source.city.name, lat: source.city.lat, lng: source.city.lng, timezone: source.city.timezone,
    searchRadiusKm: source.city.searchRadiusKm, countryCode: source.city.country.code, currency: source.city.country.currency,
  };
  const ctx: SourceContext = { sourceId, url: source.url, config: (source.config as Record<string, unknown>) ?? {}, city, log };
  const connector = CONNECTORS[source.type];
  const interval = intervalMinutes(source);
  let error: string | undefined;

  try {
    await ensureTaxonomy();

    const provider = connector.placeProvider;
    if (provider && mode === "hours") {
      await refreshHours(source, provider, c, log);
    } else if (provider) {
      const cfg = ctx.config as { categories?: string[]; maxPages?: number; radiusKm?: number };
      const categories = (cfg.categories ?? []).filter((x): x is NightlifeCategory => (NIGHTLIFE_CATEGORIES as readonly string[]).includes(x));
      const places = await provider.discover(
        { name: city.name, lat: city.lat, lng: city.lng, radiusKm: cfg.radiusKm ?? city.searchRadiusKm },
        { categories: categories.length ? categories : NIGHTLIFE_CATEGORIES, maxPages: cfg.maxPages, log },
      );
      await syncPlaces(source, provider.policy, places, c, log, {
        runStart: startedAt,
        nextSyncAt: new Date(Date.now() + interval * 60_000),
        detectMissing: provider.policy.storeContent,
        providerLabel: provider.key === "osm" ? "OpenStreetMap" : provider.label,
      });
      const linked = await linkEventsToVenues(city.id);
      if (linked) log(`${linked} eventos vinculados a sus locales`);
    } else if (connector.syncVenues && mode === "full") {
      await connector.syncVenues(source, ctx, c);
      const linked = await linkEventsToVenues(city.id);
      if (linked) log(`${linked} eventos vinculados a sus locales`);
    } else if (connector.fetchVenues && mode === "full") {
      const items = await connector.fetchVenues(ctx);
      log(`${items.length} locales recibidos`);
      await syncPlaces(source, OWN_SOURCE_POLICY, items.map((i) => toPlace(normalizeVenue(i), i.externalId, i.types)), c, log, {
        runStart: startedAt,
        nextSyncAt: new Date(Date.now() + interval * 60_000),
        detectMissing: false,
        providerLabel: source.name,
      });
      // Official registries (config.authoritative) are the full list: places they
      // no longer include (or that no longer fit the filter) leave the map.
      if ((source.config as { authoritative?: boolean } | null)?.authoritative && items.length) {
        const listed = items.map((i) => i.externalId.slice(0, 300));
        const gone = await db.sourceVenueRecord.findMany({ where: { sourceId: source.id, externalId: { notIn: listed }, venueId: { not: null } }, select: { venueId: true } });
        const { count } = await db.venue.updateMany({
          where: { id: { in: gone.map((g) => g.venueId!) }, primarySourceId: source.id, trust: "IMPORTED", isActive: true },
          data: { isActive: false },
        });
        if (count) log(`${count} locales retirados: ya no están en la lista oficial o no son de ocio nocturno`);
      }
    }

    if (connector.fetchEvents && mode === "full") {
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
  const failures = error ? source.consecutiveFailures + 1 : 0;
  await db.$transaction([
    db.syncRun.update({ where: { id: run.id }, data: { ...c, status: error ? "ERROR" : "OK", finishedAt, log: lines.join("\n") } }),
    db.discoverySource.update({
      where: { id: sourceId },
      data: {
        status: error ? "ERROR" : "OK",
        lastError: error ?? null,
        lockedUntil: null,
        consecutiveFailures: failures,
        ...(error ? { lastFailureAt: finishedAt } : { lastSuccessAt: finishedAt }),
        // Hours refreshes run on their own job schedule and leave the full-sync schedule alone.
        ...(mode === "full"
          ? {
              lastSyncAt: finishedAt,
              // Exponential backoff on errors so a broken source isn't hammered.
              nextSyncAt: new Date(finishedAt.getTime() + backoffMinutes(interval, failures) * 60_000),
              ...(error ? {} : { eventsFound: c.found }),
            }
          : {}),
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
  const touch = async () => {
    if (!existing) return;
    await db.sourceEventRecord.update({ where: { id: existing.id }, data: { lastSeenAt: now, missedSyncs: 0 } });
    if (existing.eventId) await db.event.update({ where: { id: existing.eventId }, data: { lastVerifiedAt: now } });
  };

  const res = normalizeEvent(item, city.timezone);
  if (!res.ok) {
    c.skipped++;
    log(`Omitido «${item.title}»: ${res.reason}`);
    await touch();
    return;
  }
  const n = attachVenue(res.event, venues);
  // listedVenuesOnly: only events at a place of the verified list (whatever
  // their kind: parties, concerts, festivals…). Otherwise, for broad agendas
  // (nightlifeOnly): only club nights. Not touched, so anything imported
  // earlier that no longer fits is hidden as "missing".
  const cfg = (source.config as { nightlifeOnly?: boolean; listedVenuesOnly?: boolean } | null) ?? {};
  if (cfg.listedVenuesOnly ? !n.venueId : cfg.nightlifeOnly && !isNightlifeEvent(n, venues)) {
    c.skipped++;
    if (cfg.listedVenuesOnly) log(`Fuera del listado: «${n.title.slice(0, 60)}» en «${n.venueName ?? n.locationName ?? "lugar desconocido"}»`);
    // Imported earlier under a wider filter: hidden right away.
    if (existing?.eventId) {
      const { count } = await db.event.updateMany({ where: { id: existing.eventId, primarySourceId: source.id, source: "IMPORT", status: "PUBLISHED" }, data: { status: "INACTIVE" } });
      if (count) c.deactivated++;
    }
    return;
  }
  if (n.venueId && (await fillMissingVenueCover(n.venueId, item.place?.imageUrl, source))) log(`Foto añadida a ${n.locationName ?? "la discoteca"}`);
  if (isExpired(n, now)) {
    c.skipped++;
    await touch();
    return;
  }
  const hash = contentHash(n);
  const recordData = { data: n as unknown as Prisma.InputJsonValue, contentHash: hash, sourceUrl: n.sourceUrl, lastSeenAt: now, lastSyncedAt: now, missedSyncs: 0 };

  // Already linked to an event → update it.
  if (existing?.eventId) {
    if (await fillMissingCover(existing.eventId, n, source)) log(`Foto oficial añadida a «${n.title}»`);
    if (existing.contentHash === hash) {
      c.unchanged++;
      await touch();
      return;
    }
    const { changed } = await applySourceUpdate(existing.eventId, n, source, city.name);
    await db.sourceEventRecord.update({ where: { id: existing.id }, data: recordData });
    await db.event.update({ where: { id: existing.eventId }, data: { lastVerifiedAt: now } });
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

// ─── Venues from official pages / feeds ─────────────────────────────────────

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
    type: "CLUB",
    openingHours: v.openingHours ?? null,
    googlePlaceId: null, // Google IDs only come from the Google provider
    sourceUrl: safeUrl(v.sourceUrl),
    imageUrls: (v.imageUrls ?? []).map(safeUrl).filter((u): u is string => Boolean(u)).slice(0, 3),
  };
}

/** Official-page venue → provider-neutral place (nightclub unless the page says otherwise). */
function toPlace(n: NormalizedVenue, externalId: string, types: string[] = []): ProviderPlace {
  const categories = types.filter((t): t is NightlifeCategory => (ALL_PLACE_CATEGORIES as readonly string[]).includes(t));
  return {
    providerId: externalId.slice(0, 300), name: n.name, address: n.address, neighborhood: null, lat: n.lat, lng: n.lng, phone: n.phone,
    website: n.website, instagram: n.instagram, categories: categories.length ? categories : ["nightclub"], hours: n.openingHours, businessStatus: null, rating: null, ratingCount: null,
    sourceUrl: n.sourceUrl,
  };
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

const running = new Set<string>();

export interface DueRunResult {
  ran: number;
  ok: number;
  failed: number;
  errors: string[];
  /** Sources not run (busy, or missing configuration). */
  skipped?: string[];
}

/**
 * Syncs the enabled sources of one kind whose next sync time has come
 * (sequentially; `force` ignores the schedule). Used by the EVENT_SYNC,
 * VENUE_SYNC and VENUE_HOURS_SYNC jobs.
 */
export async function runDueSources(kind: "events" | "venues", opts: { force?: boolean; mode?: SyncMode; job?: string; now?: Date } = {}): Promise<DueRunResult> {
  const result: DueRunResult = { ran: 0, ok: 0, failed: 0, errors: [] };
  const key = `${kind}:${opts.mode ?? "full"}`;
  if (!(await getSettings()).discoveryEnabled || running.has(key)) return result;
  running.add(key);
  try {
    const now = opts.now ?? new Date();
    const candidates = await db.discoverySource.findMany({
      where: { enabled: true, ...(opts.force || opts.mode === "hours" ? {} : { OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] }) },
      select: { id: true, type: true, name: true },
      orderBy: { nextSyncAt: "asc" },
      take: 100,
    });
    // Sources waiting for an API key are not due: they start on their own once it is set.
    const due = candidates.filter(
      (s) => sourceKind(s.type) === kind && !CONNECTORS[s.type].missingConfig?.() && (opts.mode !== "hours" || CONNECTORS[s.type].placeProvider?.refresh),
    );
    for (const s of due) {
      const r = await syncSource(s.id, { mode: opts.mode, job: opts.job });
      if ("skipped" in r) {
        (result.skipped ??= []).push(`${s.name}: ${r.reason ?? "ocupada"}`);
        continue;
      }
      result.ran++;
      if (r.error) {
        result.failed++;
        result.errors.push(`${s.name}: ${r.error}`);
      } else result.ok++;
    }
    return result;
  } finally {
    running.delete(key);
  }
}

/** Purges data from sources with caching limits (e.g. Google Places coordinates after 30 days). */
export async function purgeExpiredSourceData(now = new Date()) {
  const { count: removed } = await db.sourceVenueRecord.deleteMany({ where: { expiresAt: { lt: now }, venueId: null } });
  const { count: cleared } = await db.sourceVenueRecord.updateMany({ where: { expiresAt: { lt: now }, venueId: { not: null } }, data: { data: {}, expiresAt: null } });
  return { removed, cleared };
}

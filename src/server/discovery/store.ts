import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { DiscoverySource, Prisma } from "@prisma/client";
import { db } from "../db";
import { processImage } from "../media/image";
import { notifyVenueFollowers } from "../services/events";
import { CATEGORIES, GENRES } from "@/config/taxonomy";
import { SYSTEM_USERNAMES } from "@/config/system";
import { buildSearchText, slugify } from "@/lib/text";
import { fetchBytes } from "./fetcher";
import { DUPLICATE_THRESHOLD, scoreMatch, venueSimilarity, type Comparable } from "./dedupe";
import type { NormalizedEvent } from "./types";

/**
 * Database side of the discovery pipeline: venue matching, duplicate
 * lookup, event creation and field-level updates with change history.
 */

export const DISCOVERY_USERNAME = SYSTEM_USERNAMES[0];

let systemUserId: string | null = null;

/** Technical account that owns imported events/images (never shown as organizer). */
export async function discoveryUserId(): Promise<string> {
  if (systemUserId) return systemUserId;
  const existing = await db.profile.findUnique({ where: { username: DISCOVERY_USERNAME }, select: { userId: true } });
  if (existing) return (systemUserId = existing.userId);
  const user = await db.user.create({
    data: {
      email: `discovery+${randomBytes(4).toString("hex")}@system.invalid`,
      profile: { create: { username: DISCOVERY_USERNAME, displayName: "NIVEX Discovery", searchText: "" } },
    },
    select: { id: true },
  });
  return (systemUserId = user.id);
}

/** Makes sure every configured category/genre exists (idempotent). */
export async function ensureTaxonomy() {
  await Promise.all([
    ...CATEGORIES.map((c, order) => db.category.upsert({ where: { slug: c.slug }, create: { ...c, order }, update: {} })),
    ...GENRES.map((g, order) => db.musicGenre.upsert({ where: { slug: g.slug }, create: { ...g, order }, update: {} })),
  ]);
}

export function contentHash(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

// ─── Venues ──────────────────────────────────────────────────────────────────

export interface VenueCandidate {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function loadCityVenues(cityId: string): Promise<VenueCandidate[]> {
  return db.venue.findMany({ where: { cityId, isActive: true }, select: { id: true, name: true, address: true, lat: true, lng: true } });
}

export function matchVenue(venues: VenueCandidate[], name: string | null, lat: number | null, lng: number | null): VenueCandidate | null {
  if (!name) return null;
  let best: { v: VenueCandidate; s: number } | null = null;
  for (const v of venues) {
    const s = venueSimilarity({ name, lat, lng }, v);
    if (!best || s > best.s) best = { v, s };
  }
  return best && best.s >= 0.75 ? best.v : null;
}

/** Fills venue data (id, coords, address) on a normalized event when its venue is known. */
export function attachVenue(n: NormalizedEvent, venues: VenueCandidate[]): NormalizedEvent {
  const v = matchVenue(venues, n.venueName, n.lat, n.lng);
  if (!v) return n;
  return { ...n, venueId: v.id, locationName: v.name, address: n.address ?? v.address, lat: n.lat ?? v.lat, lng: n.lng ?? v.lng };
}

// ─── Duplicates ──────────────────────────────────────────────────────────────

export function toComparable(n: NormalizedEvent): Comparable {
  return {
    title: n.title,
    startsAt: new Date(n.startsAt),
    venueId: n.venueId,
    locationName: n.locationName,
    lat: n.lat,
    lng: n.lng,
    organizerName: n.organizerName,
    urls: [n.ticketUrl, n.officialUrl, n.sourceUrl],
  };
}

export async function findBestMatch(n: NormalizedEvent, cityId: string) {
  const start = new Date(n.startsAt);
  const candidates = await db.event.findMany({
    where: {
      cityId,
      status: { in: ["PUBLISHED", "PENDING", "INACTIVE"] },
      startsAt: { gte: new Date(start.getTime() - 3 * 3600_000), lte: new Date(start.getTime() + 3 * 3600_000) },
    },
    select: {
      id: true, title: true, startsAt: true, venueId: true, locationName: true, lat: true, lng: true, organizerName: true,
      ticketUrl: true, officialUrl: true, sourceRecords: { select: { sourceUrl: true } },
    },
    take: 100,
  });
  const me = toComparable(n);
  let best: { id: string; title: string; score: number; reasons: string[] } | null = null;
  for (const e of candidates) {
    const s = scoreMatch(me, { ...e, urls: [e.ticketUrl, e.officialUrl, ...e.sourceRecords.map((r) => r.sourceUrl)] });
    if (!best || s.score > best.score) best = { id: e.id, title: e.title, ...s };
  }
  return best;
}

// ─── Events ──────────────────────────────────────────────────────────────────

async function importCover(url: string, uploaderId: string): Promise<{ key: string; id: string } | null> {
  try {
    const { body, contentType } = await fetchBytes(url, { accept: "image/*", maxBytes: 8 * 1024 * 1024 });
    if (!contentType.startsWith("image/")) return null;
    const img = await processImage(body);
    const photo = await db.photo.create({ data: { uploaderId, ...img }, select: { id: true, key: true } });
    return photo;
  } catch (err) {
    console.warn("[discovery] image skipped", url, (err as Error).message);
    return null;
  }
}

type SourceLite = Pick<DiscoverySource, "id" | "trust" | "allowImages">;

export async function createEventFromNormalized(n: NormalizedEvent, source: SourceLite, city: { id: string; name: string; timezone: string; currency: string }) {
  if (n.lat == null || n.lng == null) throw new Error("Falta la ubicación (latitud/longitud)");
  const location = n.locationName ?? n.address;
  if (!location) throw new Error("Falta el lugar");
  const [category, genres, organizerId] = await Promise.all([
    db.category.findUnique({ where: { slug: n.category } }).then((c) => c ?? db.category.findUniqueOrThrow({ where: { slug: "otro" } })),
    db.musicGenre.findMany({ where: { slug: { in: n.genres } }, select: { id: true } }),
    discoveryUserId(),
  ]);
  const cover = source.allowImages && n.imageUrls[0] ? await importCover(n.imageUrls[0], organizerId) : null;
  const now = new Date();

  const event = await db.event.create({
    data: {
      slug: `${slugify(n.title) || "evento"}-${randomBytes(3).toString("hex")}`,
      title: n.title,
      description: n.description,
      categoryId: category.id,
      cityId: city.id,
      venueId: n.venueId,
      organizerId,
      organizerName: n.organizerName,
      locationName: location.slice(0, 80),
      address: n.address,
      lat: n.lat,
      lng: n.lng,
      startsAt: new Date(n.startsAt),
      endsAt: n.endsAt ? new Date(n.endsAt) : null,
      doorsAt: n.doorsAt ? new Date(n.doorsAt) : null,
      timezone: n.timezone !== city.timezone ? n.timezone : null,
      priceMin: n.priceMin,
      priceMax: n.priceMax,
      currency: n.currency && n.currency !== city.currency ? n.currency : null,
      pricing: n.priceMin && n.priceMin > 0 ? "PAID" : "FREE",
      ticketProvider: n.ticketUrl ? "EXTERNAL" : "NONE",
      ticketUrl: n.ticketUrl,
      officialUrl: n.officialUrl,
      coverKey: cover?.key,
      status: "PUBLISHED",
      source: "IMPORT",
      trust: source.trust === "OFFICIAL" ? "OFFICIAL" : "IMPORTED",
      primarySourceId: source.id,
      sourceUrl: n.sourceUrl,
      importedAt: now,
      lastSyncedAt: now,
      lastVerifiedAt: now,
      searchText: buildSearchText(n.title, location, n.address, city.name, n.organizerName, n.genres.join(" ")),
      genres: { create: genres.map((g) => ({ genreId: g.id })) },
    },
    select: { id: true, venueId: true },
  });
  if (cover) await db.photo.update({ where: { id: cover.id }, data: { eventId: event.id } });
  await notifyVenueFollowers(event.id, event.venueId, organizerId);
  return event;
}

const TRACKED = [
  "title", "description", "startsAt", "endsAt", "doorsAt", "priceMin", "priceMax", "ticketUrl", "officialUrl",
  "venueId", "locationName", "address", "lat", "lng", "organizerName", "sourceUrl",
] as const;
type Tracked = (typeof TRACKED)[number];

const asString = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

function incomingValue(n: NormalizedEvent, field: Tracked): unknown {
  switch (field) {
    case "startsAt":
      return new Date(n.startsAt);
    case "endsAt":
      return n.endsAt ? new Date(n.endsAt) : null;
    case "doorsAt":
      return n.doorsAt ? new Date(n.doorsAt) : null;
    default:
      return n[field];
  }
}

/**
 * Applies source data to an existing event. The event's primary source may
 * change any tracked field; other sources only fill empty fields. Events
 * created inside NIVEX (community/official) are never overwritten.
 */
export async function applySourceUpdate(eventId: string, n: NormalizedEvent, source: SourceLite, cityName: string): Promise<{ changed: boolean }> {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true, source: true, trust: true, status: true, primarySourceId: true, startsAt: true, title: true, locationName: true, address: true,
      description: true, endsAt: true, doorsAt: true, priceMin: true, priceMax: true, ticketUrl: true, officialUrl: true, venueId: true,
      lat: true, lng: true, organizerName: true, sourceUrl: true, genres: { select: { genre: { select: { slug: true } } } },
    },
  });
  const imported = event.source === "IMPORT";
  const promote = imported && source.trust === "OFFICIAL" && event.trust === "IMPORTED";
  const isPrimary = imported && (event.primarySourceId === source.id || promote || !event.primarySourceId);

  const data: Prisma.EventUncheckedUpdateInput = {};
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  for (const field of TRACKED) {
    const incoming = incomingValue(n, field);
    if (incoming == null) continue; // never blank data the source stopped sending
    const current = event[field];
    if (asString(incoming) === asString(current)) continue;
    if (!isPrimary && current != null) continue; // secondary sources only fill gaps
    (data as Record<string, unknown>)[field] = incoming;
    changes.push({ field, oldValue: asString(current), newValue: asString(incoming) });
  }

  if (isPrimary && n.cancelled && event.status === "PUBLISHED") {
    data.status = "CANCELLED";
    changes.push({ field: "status", oldValue: event.status, newValue: "CANCELLED" });
  } else if (isPrimary && !n.cancelled && event.status === "INACTIVE") {
    data.status = "PUBLISHED"; // listed again by its source
    changes.push({ field: "status", oldValue: "INACTIVE", newValue: "PUBLISHED" });
  }
  if (promote) {
    data.trust = "OFFICIAL";
    data.primarySourceId = source.id;
    changes.push({ field: "trust", oldValue: event.trust, newValue: "OFFICIAL" });
  }
  if (data.startsAt) data.reminderSentAt = null;
  if (data.priceMin !== undefined) data.pricing = (data.priceMin as number) > 0 ? "PAID" : "FREE";
  if (data.ticketUrl !== undefined) data.ticketProvider = "EXTERNAL";
  if (data.title || data.locationName || data.address) {
    data.searchText = buildSearchText(
      (data.title as string) ?? event.title,
      (data.locationName as string) ?? event.locationName,
      (data.address as string) ?? event.address,
      cityName,
    );
  }

  const currentGenres = event.genres.map((g) => g.genre.slug).sort().join(",");
  const genresChanged = isPrimary && n.genres.length > 0 && [...n.genres].sort().join(",") !== currentGenres;

  if (!changes.length && !genresChanged) {
    if (imported) await db.event.update({ where: { id: eventId }, data: { lastSyncedAt: new Date() } });
    return { changed: false };
  }

  await db.$transaction(async (tx) => {
    if (genresChanged) {
      const genres = await tx.musicGenre.findMany({ where: { slug: { in: n.genres } }, select: { id: true } });
      await tx.eventGenre.deleteMany({ where: { eventId } });
      await tx.eventGenre.createMany({ data: genres.map((g) => ({ eventId, genreId: g.id })) });
      changes.push({ field: "genres", oldValue: currentGenres || null, newValue: n.genres.join(",") });
    }
    await tx.event.update({ where: { id: eventId }, data: { ...data, ...(imported ? { lastSyncedAt: new Date() } : {}) } });
    await tx.eventChange.createMany({ data: changes.map((c) => ({ ...c, eventId, sourceId: source.id })) });
  });
  return { changed: true };
}

export async function isDuplicate(n: NormalizedEvent, cityId: string) {
  const best = await findBestMatch(n, cityId);
  return best && best.score >= DUPLICATE_THRESHOLD ? best : null;
}

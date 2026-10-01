import "server-only";
import type { DiscoverySource, Prisma, VenueType } from "@prisma/client";
import { db } from "../../db";
import { env } from "../../env";
import { processImage, deleteImage } from "../../media/image";
import { buildSearchText } from "@/lib/text";
import { distanceKm } from "@/lib/geo";
import { fetchBytes, fetchJson, fetchText } from "../fetcher";
import { extractJsonLdBlocks, flattenNodes, jsonLdToEvents } from "../parsers/jsonld";
import { officialSiteInfo, pagePhotos, type OfficialSiteInfo } from "../parsers/official-site";
import { discoveryUserId } from "../store";
import { applyZoneHints } from "../../zones";
import { BARCELONA_VENUES, MAIN_VENUES, type CuratedVenue } from "../curated/barcelona";
import { handleMatchesVenue, pickLocation, type Located, type NominatimItem } from "../curated/checks";
import type { Connector, ExternalEvent, SourceContext, VenueSyncCounters } from "../types";

/**
 * The verified list of places (src/server/discovery/curated). It is the whole
 * list of venues of its city: every other venue leaves the map.
 *
 * Each sync, per place:
 *  - coordinates, barrio and district: OpenStreetMap Nominatim for the
 *    published address (only when the address changed; ≤ 1 request/s);
 *  - photos, Instagram, hours and price range: the official website
 *    (robots.txt honoured), photos imported once into our storage;
 *  - events: schema.org events published on the official website.
 * config: { list: "barcelona" }
 */
const LISTS: Record<string, CuratedVenue[]> = { barcelona: BARCELONA_VENUES };
/** Music tag of the list → genre of the app's filters. */
const GENRE_OF: Record<string, string> = {
  techno: "techno", "hard techno": "techno", house: "house", "deep house": "house", "acid house": "house", "hip hop": "hip-hop",
  comercial: "comercial", "electrónica": "electronica", electro: "electronica", reggaeton: "reggaeton", latino: "latin", indie: "indie",
};
const MAX_PHOTOS = 6;
const MIN_PHOTO_WIDTH = 500;

function listOf(ctx: SourceContext): CuratedVenue[] {
  const name = String((ctx.config as { list?: unknown }).list ?? "");
  const list = LISTS[name];
  if (!list) throw new Error(`Lista verificada desconocida: «${name}»`);
  return list;
}

// Pages read once per run (venues then events use the same home page).
const pageCache = new Map<string, Promise<string | null>>();
function page(url: string, ctx: SourceContext): Promise<string | null> {
  let p = pageCache.get(url);
  if (!p) {
    p = fetchText(url, { accept: "text/html", respectRobots: true, timeoutMs: 20_000, maxBytes: 4 * 1024 * 1024 }).catch((err) => {
      ctx.log(`${url}: ${(err as Error).message}`);
      return null;
    });
    pageCache.set(url, p);
    setTimeout(() => pageCache.delete(url), 10 * 60_000).unref?.();
  }
  return p;
}

// ─── Geocoding (Nominatim) ───────────────────────────────────────────────────

let lastNominatim = 0;
/** Coordinates, barrio and district of the published address (checked to be in the right town). */
async function locate(v: CuratedVenue, ctx: SourceContext): Promise<Located | null> {
  const municipality = v.municipality ?? "Barcelona";
  const d = 0.2;
  const queries = [...new Set([v.geocodeQuery, `${v.address}, ${municipality}`].filter((q): q is string => Boolean(q)))];
  for (const q of queries) {
    const wait = lastNominatim + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatim = Date.now();
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      limit: "5",
      addressdetails: "1",
      "accept-language": "es",
      countrycodes: ctx.city.countryCode.toLowerCase(),
      viewbox: [ctx.city.lng - d, ctx.city.lat + d, ctx.city.lng + d, ctx.city.lat - d].join(","),
      bounded: "1",
    });
    const items = await fetchJson<NominatimItem[]>(`${env.NOMINATIM_URL}/search?${params}`, { timeoutMs: 15_000, maxBytes: 512 * 1024 });
    const hit = pickLocation(items, municipality, ctx.city);
    if (hit) return hit;
    ctx.log(`${v.name}: «${q}» no da un resultado en ${municipality}`);
  }
  return null;
}

// ─── Photos ──────────────────────────────────────────────────────────────────

async function importPhotos(venueId: string, urls: string[], ctx: SourceContext): Promise<string[]> {
  const uploaderId = await discoveryUserId();
  const keys: string[] = [];
  for (const url of urls) {
    if (keys.length >= MAX_PHOTOS) break;
    try {
      const { body, contentType } = await fetchBytes(url, { accept: "image/*", maxBytes: 10 * 1024 * 1024, timeoutMs: 20_000 });
      if (!contentType.startsWith("image/") || contentType.includes("svg")) continue;
      const img = await processImage(body);
      // Small images are logos or thumbnails, not photos of the place.
      if (img.width < MIN_PHOTO_WIDTH || img.height < 300) {
        await deleteImage(img.key).catch(() => {});
        continue;
      }
      await db.photo.create({ data: { uploaderId, venueId, position: keys.length, sourceUrl: url, ...img } });
      keys.push(img.key);
    } catch (err) {
      ctx.log(`Foto omitida ${url}: ${(err as Error).message}`);
    }
  }
  return keys;
}

// ─── Venues ──────────────────────────────────────────────────────────────────

const fullAddress = (v: CuratedVenue) => `${v.address}, ${v.municipality ?? "Barcelona"}`;

async function officialInfo(v: CuratedVenue, ctx: SourceContext): Promise<OfficialSiteInfo & { photos: string[] }> {
  const empty = { images: [], instagram: null, hours: null, priceMin: null, priceMax: null };
  const html = v.website ? await page(v.website, ctx) : null;
  const info = html ? officialSiteInfo(html, v.website!) : empty;
  const photos = [...info.images];
  if (photos.length < 2) {
    for (const p of v.photoPages ?? []) {
      const other = await page(p, ctx);
      if (other) for (const u of pagePhotos(other, p, 4)) if (!photos.includes(u)) photos.push(u);
    }
  }
  return { ...info, photos };
}

export async function syncCuratedVenues(source: DiscoverySource, ctx: SourceContext, c: VenueSyncCounters) {
  const list = listOf(ctx);
  const now = new Date();
  const listed: string[] = [];
  c.found = list.length;
  const genreIds = new Map((await db.musicGenre.findMany({ select: { id: true, slug: true } })).map((g) => [g.slug, g.id]));

  for (const v of list) {
    try {
      const existing = await db.venue.findUnique({
        where: { slug: v.key },
        select: { id: true, address: true, lat: true, lng: true, neighborhood: true, district: true, openingHours: true, priceMin: true, priceMax: true, instagram: true, coverKey: true, _count: { select: { photos: true } } },
      });
      const address = fullAddress(v);
      const place =
        // Reuse the stored location unless the address changed or it looks wrong (other town, no district).
        existing && existing.address === address && existing.district && distanceKm(existing, ctx.city) <= 15
          ? { lat: existing.lat, lng: existing.lng, neighborhood: existing.neighborhood, district: existing.district }
          : await locate(v, ctx).catch((err) => {
              ctx.log(`${v.name}: sin ubicación (${(err as Error).message})`);
              return null;
            });
      if (!place) {
        c.skipped++;
        ctx.log(`${v.name}: dirección no encontrada en OpenStreetMap, no se muestra`);
        if (existing) listed.push(v.key);
        continue;
      }
      listed.push(v.key);

      const site = await officialInfo(v, ctx);
      const data = {
        name: v.name,
        type: v.type as VenueType,
        description: v.description,
        address,
        neighborhood: place.neighborhood,
        district: place.district,
        lat: place.lat,
        lng: place.lng,
        status: v.status,
        isActive: v.status !== "PERMANENTLY_CLOSED",
        closedAt: v.status === "PERMANENTLY_CLOSED" ? now : null,
        inactiveReason: v.status === "PERMANENTLY_CLOSED" ? "Cerrado definitivamente" : null,
        musicTags: v.music,
        aliases: v.aliases ?? [],
        categories: ["verified"],
        website: v.website ?? null,
        // The site's account only when it is clearly this venue's (not a sister venue's).
        instagram: v.instagram ?? (site.instagram && handleMatchesVenue(site.instagram, [v.name, ...(v.aliases ?? []), v.key]) ? site.instagram : null),
        openingHours: (site.hours ?? existing?.openingHours ?? undefined) as Prisma.InputJsonValue | undefined,
        ...(site.hours ? { hoursSource: "official", hoursUpdatedAt: now } : {}),
        priceMin: site.priceMin ?? existing?.priceMin ?? null,
        priceMax: site.priceMax ?? existing?.priceMax ?? null,
        // Main places: always first (lists, home, map).
        isFeatured: MAIN_VENUES.includes(v.key),
        trust: "VERIFIED" as const,
        primarySourceId: source.id,
        sourceUrl: v.website ?? v.sources[0] ?? null,
        lastVerifiedAt: new Date(v.verifiedAt),
        lastSyncedAt: now,
        searchText: buildSearchText(v.name, [address, ...(v.aliases ?? []), ...v.music].join(" "), place.neighborhood, place.district ?? ctx.city.name),
      };
      const venue = existing
        ? await db.venue.update({ where: { id: existing.id }, data, select: { id: true } })
        : await db.venue.create({ data: { ...data, slug: v.key, cityId: ctx.city.id, importedAt: now }, select: { id: true } });
      if (existing) c.updated++;
      else c.created++;
      const genres = [...new Set(v.music.map((m) => GENRE_OF[m.toLowerCase()]).filter((g): g is string => Boolean(g && genreIds.has(g))))];
      await db.$transaction([
        db.venueGenre.deleteMany({ where: { venueId: venue.id } }),
        db.venueGenre.createMany({ data: genres.map((g) => ({ venueId: venue.id, genreId: genreIds.get(g)! })) }),
      ]);

      await db.sourceVenueRecord.upsert({
        where: { sourceId_externalId: { sourceId: source.id, externalId: v.key } },
        create: { sourceId: source.id, externalId: v.key, venueId: venue.id, data: v as unknown as Prisma.InputJsonValue, contentHash: v.verifiedAt, lastSeenAt: now, reviewStatus: "AUTO", reviewReasons: [] },
        update: { venueId: venue.id, data: v as unknown as Prisma.InputJsonValue, lastSeenAt: now, missedSyncs: 0 },
      });

      // Official photos: imported once (the gallery keeps them), cover = first.
      if (!existing?._count.photos && site.photos.length) {
        const keys = await importPhotos(venue.id, site.photos, ctx);
        if (keys.length) {
          await db.venue.update({ where: { id: venue.id }, data: { coverKey: keys[0] } });
          ctx.log(`${v.name}: ${keys.length} fotos oficiales`);
        } else ctx.log(`${v.name}: sin fotos válidas en la web oficial`);
      } else if (!site.photos.length && !existing?.coverKey) {
        ctx.log(`${v.name}: la web oficial no publica fotos accesibles`);
      }
      // Parts of the place (dance floor, DJ booth, VIP…) detected by the image model in its photos.
      const zoned = await applyZoneHints(venue.id);
      if (zoned) ctx.log(`${v.name}: ${zoned} fotos con zona detectada`);
    } catch (err) {
      c.errors++;
      ctx.log(`${v.name}: ${(err as Error).message}`);
    }
  }

  // The list is the whole city: anything else leaves the map.
  const { count } = await db.venue.updateMany({
    where: { cityId: ctx.city.id, isActive: true, slug: { notIn: listed } },
    data: { isActive: false, inactiveReason: "No está en el listado verificado" },
  });
  c.deactivated = count;
  if (count) ctx.log(`${count} locales retirados: no están en el listado verificado`);
}

// ─── Events from the official websites ───────────────────────────────────────

async function fetchCuratedEvents(ctx: SourceContext): Promise<ExternalEvent[]> {
  const out: ExternalEvent[] = [];
  for (const v of listOf(ctx)) {
    if (v.status !== "OPEN") continue;
    const pages = [...new Set([v.website, ...(v.agendaUrls ?? [])].filter((u): u is string => Boolean(u)))];
    for (const url of pages) {
      const html = await page(url, ctx);
      if (!html) continue;
      const events = jsonLdToEvents(flattenNodes(extractJsonLdBlocks(html)) as Record<string, unknown>[], url, ctx.city.timezone);
      for (const e of events) {
        // An event on a venue's own site without a location is at that venue.
        if (!e.place?.name) e.place = { ...e.place, name: v.name, address: e.place?.address ?? fullAddress(v) };
        e.externalId = `${v.key}|${e.externalId}`;
        out.push(e);
      }
      if (events.length) ctx.log(`${v.name}: ${events.length} eventos en su web`);
    }
  }
  return out;
}

export const curatedConnector: Connector = {
  label: "Listado verificado de locales (con su web oficial)",
  syncVenues: syncCuratedVenues,
  fetchEvents: fetchCuratedEvents,
};

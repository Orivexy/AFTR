import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "./db";
import { env } from "./env";

/**
 * Zones detected by the image model for official photos, keyed by the
 * photo's source URL. CI runs the model (scripts/classify-zones.mts) on the
 * photos it downloaded and ships the result with the app
 * (<snapshot>/zones.json); servers can run the same script against their own
 * database. Here we only apply those results: no model runs in the app.
 */
interface ZoneHints {
  model: string;
  photos: Record<string, { zone: string; score: number }>;
}

let cached: { file: string; at: number; hints: ZoneHints | null } | null = null;

function hintsFile(): string | null {
  const file = env.ZONE_HINTS_FILE || (env.DISCOVERY_SNAPSHOT_DIR ? path.join(env.DISCOVERY_SNAPSHOT_DIR, "zones.json") : "");
  return file && existsSync(file) ? file : null;
}

export function loadZoneHints(): ZoneHints | null {
  const file = hintsFile();
  if (!file) return null;
  if (cached?.file === file && Date.now() - cached.at < 10 * 60_000) return cached.hints;
  let hints: ZoneHints | null = null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as ZoneHints;
    if (raw && typeof raw.photos === "object") hints = raw;
  } catch (err) {
    console.warn("[zones] no se pudo leer", file, (err as Error).message);
  }
  cached = { file, at: Date.now(), hints };
  return hints;
}

/** Sets the detected zone on the venue's photos that have none yet. */
export async function applyZoneHints(venueId: string): Promise<number> {
  const hints = loadZoneHints();
  if (!hints) return 0;
  const photos = await db.photo.findMany({ where: { venueId, zone: null, sourceUrl: { not: null } }, select: { id: true, sourceUrl: true } });
  let n = 0;
  for (const p of photos) {
    const h = hints.photos[p.sourceUrl!];
    if (!h) continue;
    await db.photo.update({ where: { id: p.id }, data: { zone: h.zone, zoneScore: h.score } });
    n++;
  }
  await preferPlaceCover(venueId);
  return n;
}

/**
 * The cover should show the place itself: when the current cover is a photo
 * the model did not recognise as any part of a venue (often a logo or a
 * flyer), use the first photo that shows one.
 */
async function preferPlaceCover(venueId: string) {
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { coverKey: true } });
  const cover = venue?.coverKey ? await db.photo.findUnique({ where: { key: venue.coverKey }, select: { zone: true } }) : null;
  if (cover?.zone) return;
  const best = await db.photo.findFirst({ where: { venueId, zone: { not: null }, status: "VISIBLE" }, orderBy: { position: "asc" }, select: { key: true } });
  if (best && best.key !== venue?.coverKey) await db.venue.update({ where: { id: venueId }, data: { coverKey: best.key } });
}

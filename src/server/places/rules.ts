/**
 * Pure decision rules of the venue sync (unit-tested): venue type, which
 * fields a source may overwrite, when a run is trustworthy enough to close
 * places, and retry backoff.
 */
import type { NightlifeCategory } from "./types";

export type VenueTypeValue = "CLUB" | "BAR" | "CONCERT_HALL" | "OPEN_AIR" | "OTHER";

export function venueTypeFor(categories: readonly string[]): VenueTypeValue {
  if (categories.includes("nightclub") || categories.includes("dance_club")) return "CLUB";
  if (categories.includes("music_venue") || categories.includes("live_music_venue")) return "CONCERT_HALL";
  return "OTHER";
}

export const CATEGORY_LABELS: Record<NightlifeCategory, string> = {
  nightclub: "Discoteca",
  dance_club: "Club de baile",
  music_venue: "Sala de conciertos",
  live_music_venue: "Música en directo",
  event_venue: "Sala de eventos",
};

export interface OwnershipInput {
  sourceId: string;
  sourceTrust: "COMMUNITY" | "IMPORTED" | "OFFICIAL" | "VERIFIED";
  sourceVenueId: string | null;
  venue: { id: string; primarySourceId: string | null; trust: "COMMUNITY" | "IMPORTED" | "OFFICIAL" | "VERIFIED"; isDemo: boolean };
}

/**
 * The venue's primary source (or the venue's own official source) may update
 * any field; any other source only fills empty fields. Demo and community
 * venues are never overwritten.
 */
export function mayOverwrite({ sourceId, sourceTrust, sourceVenueId, venue }: OwnershipInput): boolean {
  if (venue.isDemo) return false;
  if (sourceTrust === "OFFICIAL" && sourceVenueId === venue.id) return true;
  if (venue.trust === "COMMUNITY") return false;
  return venue.primarySourceId === sourceId || (venue.trust === "IMPORTED" && !venue.primarySourceId);
}

/**
 * A run may close places that disappeared only if it looks complete: some
 * results, and not a sudden drop (partial response, API hiccup).
 */
export function runLooksComplete(found: number, previousFound: number): boolean {
  if (found <= 0) return false;
  return previousFound <= 0 || found >= previousFound * 0.5;
}

/** Missing from this many consecutive complete runs → treat as gone. */
export const MISSED_SYNCS_TO_CLOSE = 2;

/**
 * Retry schedule after failures: a quick first retry (30 min, or the interval
 * if shorter; never under 15 min) that doubles on every consecutive failure,
 * up to max(interval, 6 h). Never a tight loop against a broken API.
 */
export function backoffMinutes(intervalMin: number, consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return intervalMin;
  const base = Math.max(15, Math.min(intervalMin, 30));
  const cap = Math.max(intervalMin, 6 * 60);
  return Math.min(cap, base * 2 ** Math.min(consecutiveFailures - 1, 12));
}

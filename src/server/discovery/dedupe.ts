/**
 * Duplicate detection. The same party can come from Google, the club's web,
 * the promoter's feed… These pure functions score how likely two items are
 * the same event using title, venue, place, time, organizer and URLs.
 */
import { distanceKm } from "@/lib/geo";
import { normalizeSearch } from "@/lib/text";

const STOP = new Set([
  "the", "a", "de", "la", "el", "en", "at", "y", "and", "del", "les", "los", "las", "presents", "presenta", "pres",
  "party", "fiesta", "night", "noche", "session", "sesion", "club", "sala", "live", "b2b", "vs", "x", "with", "con",
]);

export function titleTokens(title: string, venueName?: string | null): Set<string> {
  const venue = new Set(normalizeSearch(venueName ?? "").split(/[^a-z0-9]+/).filter(Boolean));
  const words = normalizeSearch(title)
    .replace(/\b\d{1,2}[:.h]\d{2}\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !venue.has(w));
  // Generic words ("night", "session"…) only count when nothing else is left.
  const core = words.filter((w) => !STOP.has(w));
  return new Set(core.length ? core : words);
}

/** Max of Jaccard and containment, so "Warehouse" ≈ "Warehouse: Dark Edition". */
export function titleSimilarity(a: string, b: string, venueName?: string | null): number {
  const ta = titleTokens(a, venueName);
  const tb = titleTokens(b, venueName);
  if (!ta.size || !tb.size) return normalizeSearch(a) === normalizeSearch(b) ? 1 : 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment * 0.9);
}

export function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(k)) url.searchParams.delete(k);
    return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`.toLowerCase();
  } catch {
    return null;
  }
}

export interface Comparable {
  title: string;
  startsAt: Date;
  venueId: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  organizerName: string | null;
  urls: Array<string | null | undefined>;
}

export interface MatchScore {
  score: number;
  reasons: string[];
}

export const DUPLICATE_THRESHOLD = 0.75;
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.5;

export function scoreMatch(a: Comparable, b: Comparable): MatchScore {
  const reasons: string[] = [];
  const urlsA = new Set(a.urls.map(normalizeUrl).filter(Boolean));
  const sharedUrl = b.urls.map(normalizeUrl).some((u) => u && urlsA.has(u));

  const minutes = Math.abs(a.startsAt.getTime() - b.startsAt.getTime()) / 60_000;
  if (sharedUrl && minutes <= 24 * 60) return { score: 1, reasons: ["misma URL"] };

  const time = minutes <= 30 ? 1 : minutes <= 90 ? 0.6 : minutes <= 180 ? 0.2 : 0;
  if (time === 0) return { score: 0, reasons: [] };

  let place = 0;
  if (a.venueId && b.venueId) place = a.venueId === b.venueId ? 1 : 0;
  else if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const d = distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    place = d <= 0.15 ? 1 : d <= 0.5 ? 0.5 : 0;
  }
  if (!place && a.locationName && b.locationName) place = titleSimilarity(a.locationName, b.locationName) >= 0.8 ? 0.8 : 0;

  const venueName = a.locationName ?? b.locationName;
  const title = titleSimilarity(a.title, b.title, venueName);
  const organizer = a.organizerName && b.organizerName && normalizeSearch(a.organizerName) === normalizeSearch(b.organizerName) ? 1 : 0;

  if (title >= 0.6) reasons.push(`título ${Math.round(title * 100)}%`);
  if (place >= 0.8) reasons.push("mismo lugar");
  if (time === 1) reasons.push("misma hora");
  if (organizer) reasons.push("mismo organizador");

  // Same place + same time + some title overlap is the strongest signal for parties.
  const score = 0.5 * title + 0.3 * place + 0.15 * time + 0.05 * organizer;
  return { score: Math.min(1, place === 1 && time === 1 && title >= 0.34 ? Math.max(score, 0.78) : score), reasons };
}

export function venueSimilarity(a: { name: string; lat: number | null; lng: number | null }, b: { name: string; lat: number | null; lng: number | null }): number {
  const name = titleSimilarity(a.name, b.name);
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return name >= 0.99 ? 0.8 : name * 0.6;
  const d = distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  const near = d <= 0.08 ? 1 : d <= 0.2 ? 0.6 : 0;
  return 0.6 * name + 0.4 * near;
}

import "server-only";
import { env } from "../env";
import { fetchJson } from "../discovery/fetcher";
import { withQuota } from "../places/usage";

/**
 * Address search with OpenStreetMap Nominatim (no API key). Its usage policy
 * allows at most 1 request per second with an identifying User-Agent and
 * asks for caching: requests are serialised, results cached, and only
 * signed-in users can search (to create events or fix a venue's location).
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

const CACHE_TTL_MS = 24 * 3600_000;
const cache = new Map<string, { at: number; results: GeocodeResult[] }>();
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

/** One request at a time, ≥ 1.1 s apart, for the whole process. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
}

export async function geocode(query: string, near: { lat: number; lng: number; countryCode: string }): Promise<GeocodeResult[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 3) return [];
  const key = `${near.countryCode}|${near.lat.toFixed(1)},${near.lng.toFixed(1)}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  // Prefer results around the city (±0.4°), without excluding the rest of the country.
  const d = 0.4;
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "6",
    addressdetails: "0",
    "accept-language": "es",
    countrycodes: near.countryCode.toLowerCase(),
    viewbox: [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(","),
  });
  const items = await serial(() =>
    withQuota("nominatim", () => fetchJson<NominatimItem[]>(`${env.NOMINATIM_URL}/search?${params}`, { timeoutMs: 10_000, maxBytes: 512 * 1024 })),
  );
  const results = items
    .map((i) => ({ label: i.display_name, lat: Number(i.lat), lng: Number(i.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (cache.size > 1000) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), results });
  return results;
}

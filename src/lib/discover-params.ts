import { ISO_DATE_RE, type DateFilter } from "./time";

export interface DiscoverParams {
  when?: DateFilter;
  date?: string;
  price?: string;
  category?: string;
  genre?: string;
  venue?: string;
  near?: string;
  radius?: string;
  lat?: string;
  lng?: string;
}

const WHEN = new Set(["today", "tomorrow", "weekend", "week", "upcoming"]);
export const PRICE_BUCKETS: Record<string, number> = { free: 0, "10": 1000, "20": 2000, "30": 3000 };
export const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;

/** Maps discover URL params to service query options + API query string. */
export function parseDiscover(sp: DiscoverParams) {
  const date = sp.date && ISO_DATE_RE.test(sp.date) ? sp.date : undefined;
  const when = !date && sp.when && WHEN.has(sp.when) ? sp.when : undefined;
  const maxPrice = sp.price && sp.price in PRICE_BUCKETS ? PRICE_BUCKETS[sp.price] : undefined;
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const radiusKm = RADIUS_OPTIONS.includes(Number(sp.radius) as (typeof RADIUS_OPTIONS)[number]) ? Number(sp.radius) : 5;
  const near = sp.near === "1" && Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng ? { lat, lng, radiusKm } : undefined;
  const categories = sp.category ? [sp.category.slice(0, 20)] : undefined;
  const genres = sp.genre ? [sp.genre.slice(0, 20)] : undefined;
  const venueId = sp.venue && /^[a-z0-9]{10,40}$/i.test(sp.venue) ? sp.venue : undefined;

  const qs = new URLSearchParams();
  if (when) qs.set("when", when);
  if (date) qs.set("date", date);
  if (maxPrice !== undefined) qs.set("maxPrice", String(maxPrice));
  if (categories) qs.set("category", categories.join(","));
  if (genres) qs.set("genre", genres.join(","));
  if (venueId) qs.set("venue", venueId);
  if (near) {
    qs.set("lat", String(near.lat));
    qs.set("lng", String(near.lng));
    qs.set("radius", String(near.radiusKm));
  }
  const hasFilters = Boolean(when || date || maxPrice !== undefined || categories || genres || venueId || sp.near === "1");
  const waitingForLocation = sp.near === "1" && !near;
  return { when, date, maxPrice, categories, genres, venueId, near, qs: qs.toString(), hasFilters, waitingForLocation };
}

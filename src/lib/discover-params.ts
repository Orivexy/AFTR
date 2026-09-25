import type { DateFilter } from "./time";

export interface DiscoverParams {
  when?: DateFilter;
  price?: string;
  category?: string;
  genre?: string;
  near?: string;
  lat?: string;
  lng?: string;
}

const WHEN = new Set(["today", "tomorrow", "weekend", "week", "upcoming"]);

/** Maps discover URL params to service query options + API query string. */
export function parseDiscover(sp: DiscoverParams) {
  const when = sp.when && WHEN.has(sp.when) ? sp.when : undefined;
  const maxPrice = sp.price === "free" ? 0 : sp.price === "10" ? 1000 : sp.price === "20" ? 2000 : undefined;
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const near = sp.near === "1" && Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng ? { lat, lng, radiusKm: 5 } : undefined;
  const categories = sp.category ? [sp.category.slice(0, 20)] : undefined;
  const genres = sp.genre ? [sp.genre.slice(0, 20)] : undefined;

  const qs = new URLSearchParams();
  if (when) qs.set("when", when);
  if (maxPrice !== undefined) qs.set("maxPrice", String(maxPrice));
  if (categories) qs.set("category", categories.join(","));
  if (genres) qs.set("genre", genres.join(","));
  if (near) {
    qs.set("lat", String(near.lat));
    qs.set("lng", String(near.lng));
  }
  const hasFilters = Boolean(when || maxPrice !== undefined || categories || genres || sp.near === "1");
  const waitingForLocation = sp.near === "1" && !near;
  return { when, maxPrice, categories, genres, near, qs: qs.toString(), hasFilters, waitingForLocation };
}

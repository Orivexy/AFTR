import { distanceKm } from "@/lib/geo";
import { normalizeSearch } from "@/lib/text";

/**
 * Sanity checks for what the verified list takes from other sources, so a
 * wrong match never reaches the map: a geocoding result in another town, or
 * an Instagram account of a sister venue linked from the same website.
 */

export interface NominatimItem {
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

export interface Located {
  lat: number;
  lng: number;
  /** Barrio (quarter / neighbourhood). */
  neighborhood: string | null;
  /** District (or the municipality when it is not the city itself). */
  district: string | null;
}

const same = (a: string | undefined, b: string) => Boolean(a) && normalizeSearch(a!) === normalizeSearch(b);

/**
 * First result that is really in the venue's municipality and near the city
 * (Nominatim's viewbox only prefers, it does not exclude: "Carrer de Mèxic 7"
 * also exists in Sabadell). Barcelona's OSM addresses carry the barri as
 * quarter/neighbourhood and the district as suburb (or city_district).
 */
export function pickLocation(items: NominatimItem[], municipality: string, center: { lat: number; lng: number }, maxKm = 15): Located | null {
  for (const it of items) {
    const lat = Number(it.lat);
    const lng = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const a = it.address ?? {};
    const town = a.city ?? a.town ?? a.village ?? a.municipality;
    if (!same(town, municipality)) continue;
    if (distanceKm(center, { lat, lng }) > maxKm) continue;
    const barrio = a.quarter ?? a.neighbourhood ?? null;
    const district = a.city_district ?? a.suburb ?? null;
    const sameCity = same(municipality, "Barcelona");
    return {
      lat,
      lng,
      neighborhood: barrio && barrio !== district ? barrio : null,
      district: sameCity ? district : municipality,
    };
  }
  return null;
}

const words = (s: string) =>
  normalizeSearch(s)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !["sala", "club", "the", "bcn", "barcelona", "disco", "discoteca", "oficial", "official"].includes(w));

/**
 * Is an Instagram handle found on a website plausibly the venue's own? It
 * must contain a distinctive word of the venue's name or aliases (sister
 * venues and parent groups link their other accounts from the same page).
 */
export function handleMatchesVenue(handle: string, names: string[]): boolean {
  const h = normalizeSearch(handle).replace(/[^a-z0-9]+/g, "");
  return names.some((n) => words(n).some((w) => h.includes(w.replace(/[^a-z0-9]+/g, ""))));
}

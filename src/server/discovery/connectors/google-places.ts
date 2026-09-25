import "server-only";
import { env } from "../../env";
import { fetchJson } from "../fetcher";
import type { Connector, ExternalVenue } from "../types";

/**
 * Google Places API (New) — Text Search, venues only (Google has no public
 * events API; we never scrape Google Search). config:
 * { query?: string, includedType?: string, maxPages?: number }
 *
 * Google Maps Platform terms limit caching: only the place id may be kept
 * indefinitely. Records from this connector expire after `retentionDays` and
 * are purged; staff confirm venue data from official sources on approval.
 */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const hhmm = (h?: number, m?: number) => `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;

interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  regularOpeningHours?: { periods?: Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }> };
}

export const googlePlacesConnector: Connector = {
  label: "Google Places API (locales)",
  retentionDays: 30,
  async fetchVenues(ctx) {
    if (!env.GOOGLE_PLACES_API_KEY) throw new Error("Falta GOOGLE_PLACES_API_KEY");
    const cfg = ctx.config as { query?: string; includedType?: string; maxPages?: number };
    const out: ExternalVenue[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < Math.min(cfg.maxPages ?? 3, 5); page++) {
      const data = await fetchJson<{ places?: Place[]; nextPageToken?: string }>("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.types,places.regularOpeningHours.periods,nextPageToken",
        },
        body: JSON.stringify({
          textQuery: cfg.query ?? `discoteca ${ctx.city.name}`,
          includedType: cfg.includedType ?? "night_club",
          pageSize: 20,
          pageToken,
          locationBias: { circle: { center: { latitude: ctx.city.lat, longitude: ctx.city.lng }, radius: Math.min(50_000, ctx.city.searchRadiusKm * 1000) } },
        }),
      });
      for (const p of data.places ?? []) {
        const hours: Record<string, Array<{ open: string; close: string }>> = {};
        for (const period of p.regularOpeningHours?.periods ?? []) {
          if (period.open?.day == null) continue;
          const key = DAY_KEYS[period.open.day]!;
          (hours[key] ??= []).push({ open: hhmm(period.open.hour, period.open.minute), close: hhmm(period.close?.hour, period.close?.minute) });
        }
        out.push({
          externalId: p.id,
          googlePlaceId: p.id,
          name: p.displayName?.text ?? "",
          address: p.formattedAddress ?? null,
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
          phone: p.nationalPhoneNumber ?? null,
          website: p.websiteUri ?? null,
          types: p.types,
          openingHours: Object.keys(hours).length ? hours : null,
          sourceUrl: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return out.filter((v) => v.name);
  },
};

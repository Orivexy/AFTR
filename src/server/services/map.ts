import "server-only";
import { db } from "../db";
import { env } from "../env";
import type { MapPlace, OpeningHours } from "@/lib/types";
import type { CityData } from "./cities";

/**
 * Map provider configuration. Keyless providers load tiles directly; keyed
 * providers go through /api/map/tiles so tokens never reach the browser.
 * To add Google Maps / Mapbox GL later, implement another MapCanvas and
 * switch on `provider` in the client.
 */
export interface MapConfig {
  provider: "carto" | "mapbox" | "maptiler";
  tileUrl: string;
  attribution: string;
  maxZoom: number;
}

export function getMapConfig(): MapConfig {
  switch (env.MAP_PROVIDER) {
    case "mapbox":
      return {
        provider: "mapbox",
        tileUrl: "/api/map/tiles/{z}/{x}/{y}",
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © OpenStreetMap',
        maxZoom: 19,
      };
    case "maptiler":
      return {
        provider: "maptiler",
        tileUrl: "/api/map/tiles/{z}/{x}/{y}",
        attribution: '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © OpenStreetMap',
        maxZoom: 19,
      };
    default:
      return {
        provider: "carto",
        tileUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      };
  }
}

/** Upstream URL for keyed providers (server-side only). */
export function upstreamTileUrl(z: number, x: number, y: number): string | null {
  if (env.MAP_PROVIDER === "mapbox" && env.MAPBOX_TOKEN) {
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${z}/${x}/${y}@2x?access_token=${env.MAPBOX_TOKEN}`;
  }
  if (env.MAP_PROVIDER === "maptiler" && env.MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/dataviz-dark/256/${z}/${x}/${y}@2x.png?key=${env.MAPTILER_KEY}`;
  }
  return null;
}

const eventMiniSelect = { slug: true, title: true, startsAt: true, endsAt: true, priceMin: true, priceMax: true } as const;

/**
 * Everything to plot for a city: venues (with their current / next event)
 * and standalone events of the next 7 days that are not in a venue.
 */
export async function getMapPlaces(city: CityData): Promise<MapPlace[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 3600_000);
  const upcoming = {
    status: "PUBLISHED" as const,
    startsAt: { lt: horizon },
    OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gt: new Date(now.getTime() - 6 * 3600_000) } }],
  };

  const [venues, events] = await Promise.all([
    db.venue.findMany({
      where: { cityId: city.id, isActive: true },
      select: {
        id: true, slug: true, name: true, lat: true, lng: true, coverKey: true, address: true, type: true,
        ratingAvg: true, ratingCount: true, priceMin: true, priceMax: true, openingHours: true,
        events: { where: upcoming, orderBy: { startsAt: "asc" }, take: 2, select: eventMiniSelect },
      },
    }),
    db.event.findMany({
      where: { cityId: city.id, venueId: null, ...upcoming },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: {
        id: true, ...eventMiniSelect, lat: true, lng: true, coverKey: true, locationName: true, address: true,
        category: { select: { slug: true } },
      },
    }),
  ]);

  const isNow = (e: { startsAt: Date; endsAt: Date | null }) => e.startsAt <= now && (!e.endsAt || e.endsAt > now);

  return [
    ...venues.map<MapPlace>((v) => {
      const current = v.events.find(isNow) ?? null;
      const next = v.events.find((e) => e !== current) ?? null;
      return {
        kind: "venue", id: v.id, slug: v.slug, name: v.name, lat: v.lat, lng: v.lng, coverKey: v.coverKey,
        address: v.address, category: v.type === "CLUB" ? "club" : v.type.toLowerCase(),
        ratingAvg: v.ratingAvg, ratingCount: v.ratingCount, priceMin: v.priceMin, priceMax: v.priceMax,
        currency: city.currency, timezone: city.timezone, currentEvent: current, nextEvent: next,
        openingHours: (v.openingHours as OpeningHours | null) ?? null,
      };
    }),
    ...events.map<MapPlace>((e) => ({
      kind: "event", id: e.id, slug: e.slug, name: e.title, lat: e.lat, lng: e.lng, coverKey: e.coverKey,
      address: e.address ?? e.locationName, category: e.category.slug, ratingAvg: null, ratingCount: null,
      priceMin: e.priceMin, priceMax: e.priceMax, currency: city.currency, timezone: city.timezone,
      currentEvent: isNow(e) ? e : null, nextEvent: isNow(e) ? null : e, openingHours: null,
    })),
  ];
}

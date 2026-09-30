import "server-only";
import { env } from "../../env";
import { fetchJson } from "../fetcher";
import { withQuota } from "../../places/usage";
import type { Connector, ExternalEvent } from "../types";

/**
 * Ticketmaster Discovery API (official, key-based). config:
 * { classificationName?: string, keyword?: string, radiusKm?: number, maxPages?: number }
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */
interface TmEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string }; end?: { dateTime?: string }; timezone?: string; status?: { code?: string } };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  images?: Array<{ url: string; width?: number; ratio?: string }>;
  classifications?: Array<{ genre?: { name?: string }; subGenre?: { name?: string } }>;
  promoter?: { name?: string };
  _embedded?: { venues?: Array<{ name?: string; address?: { line1?: string }; city?: { name?: string }; location?: { latitude?: string; longitude?: string } }> };
}

export const ticketmasterConnector: Connector = {
  label: "Ticketmaster Discovery API",
  missingConfig: () => (env.TICKETMASTER_API_KEY ? null : "Falta la clave TICKETMASTER_API_KEY"),
  async fetchEvents(ctx) {
    if (!env.TICKETMASTER_API_KEY) throw new Error("Falta TICKETMASTER_API_KEY");
    const cfg = ctx.config as { classificationName?: string; keyword?: string; radiusKm?: number; maxPages?: number };
    const out: ExternalEvent[] = [];
    const maxPages = Math.min(cfg.maxPages ?? 3, 5);
    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({
        apikey: env.TICKETMASTER_API_KEY,
        latlong: `${ctx.city.lat},${ctx.city.lng}`,
        radius: String(Math.round(cfg.radiusKm ?? ctx.city.searchRadiusKm)),
        unit: "km",
        size: "100",
        page: String(page),
        sort: "date,asc",
        classificationName: cfg.classificationName ?? "music",
        ...(cfg.keyword ? { keyword: cfg.keyword } : {}),
      });
      const data = await withQuota("ticketmaster", () => fetchJson<{ _embedded?: { events?: TmEvent[] }; page?: { totalPages?: number } }>(`https://app.ticketmaster.com/discovery/v2/events.json?${qs}`));
      for (const e of data._embedded?.events ?? []) {
        const v = e._embedded?.venues?.[0];
        const price = e.priceRanges?.[0];
        const start = e.dates?.start;
        out.push({
          externalId: e.id,
          title: e.name,
          description: e.info ?? null,
          start: start?.dateTime ? { kind: "instant", iso: start.dateTime } : start?.localDate ? { kind: "local", date: start.localDate, time: start.localTime?.slice(0, 5) ?? null, tz: e.dates?.timezone } : null,
          end: e.dates?.end?.dateTime ? { kind: "instant", iso: e.dates.end.dateTime } : null,
          place: v ? { name: v.name, address: [v.address?.line1, v.city?.name].filter(Boolean).join(", "), city: v.city?.name, lat: Number(v.location?.latitude) || null, lng: Number(v.location?.longitude) || null } : null,
          priceMin: price?.min != null ? Math.round(price.min * 100) : null,
          priceMax: price?.max != null ? Math.round(price.max * 100) : null,
          currency: price?.currency,
          ticketUrl: e.url,
          sourceUrl: e.url,
          organizerName: e.promoter?.name ?? null,
          genres: (e.classifications ?? []).flatMap((c) => [c.genre?.name, c.subGenre?.name]).filter((g): g is string => Boolean(g) && g !== "Undefined"),
          imageUrls: (e.images ?? []).filter((i) => i.ratio === "16_9").sort((a, b) => (b.width ?? 0) - (a.width ?? 0)).map((i) => i.url).slice(0, 1),
          cancelled: e.dates?.status?.code === "cancelled",
        });
      }
      if (page + 1 >= (data.page?.totalPages ?? 1)) break;
    }
    return out;
  },
};

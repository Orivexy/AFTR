import "server-only";
import { fetchJson } from "../fetcher";
import { BCN_MUSIC_VENUES_RESOURCE, parseBcnMusicVenues } from "../parsers/bcn-music-venues";
import type { Connector } from "../types";

const DATASTORE = "https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search";

/**
 * Barcelona City Council open data: "Espais de música i copes" — clubs,
 * music bars, cocktail bars… with official address, coordinates, phone and
 * opening hours (CKAN datastore API, no key, CC BY 4.0, updated weekly).
 * https://opendata-ajuntament.barcelona.cat/data/es/dataset/culturailleure-espaismusicacopes
 */
export const bcnMusicVenuesConnector: Connector = {
  label: "Ayuntamiento de Barcelona · espacios de música y copas (datos abiertos)",
  async fetchVenues(ctx) {
    const url = new URL(ctx.url || DATASTORE);
    url.searchParams.set("resource_id", typeof ctx.config.resourceId === "string" ? ctx.config.resourceId : BCN_MUSIC_VENUES_RESOURCE);
    url.searchParams.set("limit", "10000");
    const json = await fetchJson<{ success?: boolean; result?: { records?: unknown[]; total?: number } }>(url.toString(), { timeoutMs: 60_000, maxBytes: 30 * 1024 * 1024 });
    if (!json.success || !json.result?.records) throw new Error("El portal de datos abiertos de Barcelona no devolvió registros");
    const { venues, skipped } = parseBcnMusicVenues(json.result.records);
    ctx.log(`Barcelona datos abiertos: ${venues.length} locales de música y copas (${skipped} sin categoría de ocio o sin coordenadas)`);
    return venues;
  },
};

import "server-only";
import { fetchJson } from "../fetcher";
import { parseMadridAgenda } from "../parsers/madrid-agenda";
import type { Connector } from "../types";

export const MADRID_AGENDA_URL = "https://datos.madrid.es/egob/catalogo/206974-0-agenda-eventos-culturales-100.json";

/**
 * Ayuntamiento de Madrid open data: "Actividades culturales y de ocio
 * municipal en los próximos 100 días" (no key, updated daily, open licence
 * with attribution). Only music, parties/fiestas and dance are imported.
 * https://datos.madrid.es/dataset/206974-0-agenda-eventos-culturales-100
 */
export const madridAgendaConnector: Connector = {
  label: "Datos abiertos del Ayuntamiento de Madrid (agenda de ocio)",
  async fetchEvents(ctx) {
    const json = await fetchJson<unknown>(ctx.url || MADRID_AGENDA_URL, { timeoutMs: 60_000, maxBytes: 40 * 1024 * 1024 });
    const { events, skipped } = parseMadridAgenda(json, ctx.city.timezone);
    ctx.log(`Madrid datos abiertos: ${events.length} actividades de música, fiestas y baile (${skipped} de otros tipos o sin fecha ignoradas)`);
    return events;
  },
};

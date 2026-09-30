import "server-only";
import { fetchJson } from "../fetcher";
import { BARCELONA_MUNICIPALITY, CATALONIA_AGENDA_URL, parseCataloniaAgenda } from "../parsers/catalonia-agenda";
import type { Connector } from "../types";

/**
 * Generalitat de Catalunya open data: "Agenda cultural de Catalunya"
 * (Socrata API, no key, updated daily, open licence with attribution).
 * Concerts, festivals, festes majors and popular parties of one
 * municipality (Barcelona by default: config.municipality), with price,
 * place, coordinates and the official ticket link.
 * https://analisi.transparenciacatalunya.cat/d/rhpv-yr4f
 */
export const cataloniaAgendaConnector: Connector = {
  label: "Agenda cultural de Catalunya (datos abiertos de la Generalitat)",
  async fetchEvents(ctx) {
    const municipality = typeof ctx.config.municipality === "string" && ctx.config.municipality ? ctx.config.municipality : BARCELONA_MUNICIPALITY;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.city.timezone }).format(new Date());
    const url = new URL(ctx.url || CATALONIA_AGENDA_URL);
    url.searchParams.set("$where", `comarca_i_municipi = '${municipality.replace(/'/g, "''")}' AND data_fi >= '${today}T00:00:00'`);
    url.searchParams.set("$order", "data_inici ASC, codi ASC");
    url.searchParams.set("$limit", "3000");
    const items = await fetchJson<unknown>(url.toString(), { timeoutMs: 60_000, maxBytes: 30 * 1024 * 1024 });
    const { events, skipped } = parseCataloniaAgenda(items, ctx.city.timezone);
    ctx.log(`Agenda de Catalunya: ${events.length} conciertos, festivales y fiestas (${skipped} de otros tipos, largos o sin fecha ignorados)`);
    return events;
  },
};

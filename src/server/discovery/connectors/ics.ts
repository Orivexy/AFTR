import "server-only";
import { fetchText } from "../fetcher";
import { parseIcs } from "../parsers/ics";
import type { Connector } from "../types";

/** Public iCalendar feeds (club/promoter calendars, public Google Calendar ICS links). */
export const icsConnector: Connector = {
  label: "Calendario iCal (.ics)",
  async fetchEvents(ctx) {
    if (!ctx.url) throw new Error("La fuente necesita una URL .ics");
    const text = await fetchText(ctx.url, { accept: "text/calendar, text/plain;q=0.8" });
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("La URL no devuelve un calendario iCal");
    return parseIcs(text);
  },
};

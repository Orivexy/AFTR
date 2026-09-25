/**
 * Minimal iCalendar (RFC 5545) VEVENT parser: unfolding, escaping, TZID /
 * UTC / floating / all-day dates, GEO, STATUS, URL, CATEGORIES. Recurring
 * events (RRULE) are reported as unsupported instead of being guessed.
 */
import type { ExternalEvent, SourceDateTime } from "../types";

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  // NAME;PARAM=VALUE;PARAM="VALUE":value  (colons may appear inside quoted params)
  let inQuotes = false;
  let split = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ":" && !inQuotes) {
      split = i;
      break;
    }
  }
  if (split < 0) return null;
  const [name, ...paramParts] = line.slice(0, split).split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name!.toUpperCase(), params, value: line.slice(split + 1) };
}

export function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

export function parseIcsDate(prop: Prop, calendarTz: string | null): SourceDateTime | null {
  const v = prop.value.trim();
  const date = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (date || prop.params.VALUE === "DATE") {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? { kind: "local", date: `${m[1]}-${m[2]}-${m[3]}`, time: null, tz: prop.params.TZID ?? calendarTz } : null;
  }
  const dt = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!dt) return null;
  const [, y, mo, d, h, mi, s, z] = dt;
  if (z) return { kind: "instant", iso: `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}Z` };
  return { kind: "local", date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, tz: prop.params.TZID ?? calendarTz };
}

export function parseIcs(text: string): ExternalEvent[] {
  const lines = unfold(text);
  const events: ExternalEvent[] = [];
  let calendarTz: string | null = null;
  let current: Prop[] | null = null;
  let depth = 0; // nested components inside VEVENT (VALARM)

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line === "BEGIN:VEVENT") {
      current = [];
      depth = 0;
      continue;
    }
    if (current && line.startsWith("BEGIN:")) depth++;
    if (current && line.startsWith("END:") && line !== "END:VEVENT") {
      depth--;
      continue;
    }
    if (line === "END:VEVENT" && current) {
      const ev = toEvent(current, calendarTz);
      if (ev) events.push(ev);
      current = null;
      continue;
    }
    const prop = parseLine(line);
    if (!prop) continue;
    if (!current && prop.name === "X-WR-TIMEZONE") calendarTz = prop.value.trim();
    if (current && depth === 0) current.push(prop);
  }
  return events;
}

function toEvent(props: Prop[], calendarTz: string | null): ExternalEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const uid = get("UID")?.value.trim();
  const summary = get("SUMMARY");
  if (!uid || !summary) return null;
  const recurrenceId = get("RECURRENCE-ID")?.value.trim();
  const dtStart = get("DTSTART");
  const dtEnd = get("DTEND");
  const geo = get("GEO")?.value.split(/[;,]/).map(Number);
  const location = get("LOCATION") ? unescapeText(get("LOCATION")!.value) : null;
  const url = get("URL")?.value.trim() || null;
  const categories = props.filter((p) => p.name === "CATEGORIES").flatMap((p) => unescapeText(p.value).split(","));

  return {
    externalId: recurrenceId ? `${uid}#${recurrenceId}` : uid,
    title: unescapeText(summary.value),
    description: get("DESCRIPTION") ? unescapeText(get("DESCRIPTION")!.value) : null,
    start: dtStart ? parseIcsDate(dtStart, calendarTz) : null,
    end: dtEnd ? parseIcsDate(dtEnd, calendarTz) : null,
    place: {
      name: location ? location.split(",")[0]!.trim() : null,
      address: location,
      lat: geo && Number.isFinite(geo[0]) ? geo[0] : null,
      lng: geo && Number.isFinite(geo[1]) ? geo[1] : null,
    },
    officialUrl: url,
    sourceUrl: url,
    genres: categories.map((c) => c.trim()).filter(Boolean),
    cancelled: get("STATUS")?.value.trim().toUpperCase() === "CANCELLED",
    unsupported: get("RRULE") ? "Evento recurrente (RRULE) no soportado" : null,
  };
}

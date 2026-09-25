import { TZDate } from "@date-fns/tz";

/**
 * Nightlife days don't end at midnight: a party at 01:00 on Saturday belongs
 * to "Friday night". A "night" runs from NIGHT_START_HOUR local time until
 * the same hour the next day.
 */
export const NIGHT_START_HOUR = 6;

export interface TimeWindow {
  from: Date;
  to: Date;
}

/** Local calendar date (y, m, d) of the current night in `tz`. */
function nightAnchor(now: Date, tz: string): TZDate {
  const local = new TZDate(now.getTime(), tz);
  const anchor = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), NIGHT_START_HOUR, 0, 0, tz);
  if (local.getHours() < NIGHT_START_HOUR) anchor.setDate(anchor.getDate() - 1);
  return anchor;
}

function addDays(d: TZDate, days: number): TZDate {
  const copy = new TZDate(d.getTime(), d.timeZone ?? "UTC");
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function nightWindow(tz: string, dayOffset = 0, now = new Date()): TimeWindow {
  const start = addDays(nightAnchor(now, tz), dayOffset);
  return { from: new Date(start.getTime()), to: new Date(addDays(start, 1).getTime()) };
}

/** Friday night → Monday morning of the current week (or the coming one). */
export function weekendWindow(tz: string, now = new Date()): TimeWindow {
  const anchor = nightAnchor(now, tz);
  const dow = anchor.getDay(); // 0 = Sunday
  // Days until Friday; if we're already in Fri/Sat/Sun night, the weekend started.
  const offset = dow === 5 ? 0 : dow === 6 ? -1 : dow === 0 ? -2 : 5 - dow;
  const friday = addDays(anchor, offset);
  return { from: new Date(friday.getTime()), to: new Date(addDays(friday, 3).getTime()) };
}

export type DateFilter = "today" | "tomorrow" | "weekend" | "week" | "upcoming";

export function dateFilterWindow(filter: DateFilter, tz: string, now = new Date()): TimeWindow {
  switch (filter) {
    case "today":
      return nightWindow(tz, 0, now);
    case "tomorrow":
      return nightWindow(tz, 1, now);
    case "weekend":
      return weekendWindow(tz, now);
    case "week":
      return { from: nightWindow(tz, 0, now).from, to: nightWindow(tz, 7, now).from };
    case "upcoming":
      return { from: nightWindow(tz, 0, now).from, to: nightWindow(tz, 120, now).from };
  }
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatTime(date: Date, tz: string): string {
  const d = new TZDate(date.getTime(), tz);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Viernes 25 septiembre" */
export function formatLongDate(date: Date, tz: string): string {
  const d = new TZDate(date.getTime(), tz);
  return `${capitalize(WEEKDAYS[d.getDay()]!)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "25 sept" */
export function formatShortDate(date: Date, tz: string): string {
  const d = new TZDate(date.getTime(), tz);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** "Hoy", "Mañana", "Sáb 27 sept" — relative to the current night. */
export function formatRelativeDay(date: Date, tz: string, now = new Date()): string {
  const today = nightWindow(tz, 0, now);
  const tomorrow = nightWindow(tz, 1, now);
  if (date >= today.from && date < today.to) return "Hoy";
  if (date >= tomorrow.from && date < tomorrow.to) return "Mañana";
  const d = new TZDate(date.getTime(), tz);
  return `${capitalize(WEEKDAYS[d.getDay()]!.slice(0, 3))} ${formatShortDate(date, tz)}`;
}

export function isHappeningNow(startsAt: Date, endsAt: Date | null, now = new Date()): boolean {
  const end = endsAt ?? new Date(startsAt.getTime() + 6 * 3600_000);
  return startsAt <= now && now < end;
}

/** "hace 3 h", "hace 2 d" */
export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "ahora";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.round(d / 7);
  if (w < 5) return `hace ${w} sem`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/**
 * Converts a local date + time in `tz` (as typed in a form: "2026-09-25",
 * "22:00") into a UTC Date.
 */
export function localToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y!, m! - 1, d!, hh!, mm!, 0, tz).getTime());
}

/** Inverse of localToUtc: { date: "2026-09-25", time: "22:00" }. */
export function utcToLocalParts(date: Date, tz: string): { date: string; time: string } {
  const d = new TZDate(date.getTime(), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

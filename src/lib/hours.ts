import { TZDate } from "@date-fns/tz";
import { localToUtc } from "./time";
import type { OpeningHours } from "./types";

/**
 * Weekly opening hours. A slot whose close time is not after its open time
 * ends on the next calendar day: `fri: [{ open: "23:00", close: "06:00" }]`
 * runs from Friday 23:00 until Saturday 06:00. "00:00"–"00:00" is 24 hours.
 *
 * Everything is computed on concrete local dates of the venue's timezone, so
 * daylight-saving changes and slots crossing midnight come out right.
 */

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const WEEK_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado", sun: "Domingo",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface Interval {
  start: Date;
  end: Date;
}

/** Keeps only well-formed slots; returns null when nothing usable is left. */
export function sanitizeHours(value: unknown): OpeningHours | null {
  if (!value || typeof value !== "object") return null;
  const out: OpeningHours = {};
  for (const key of DAY_KEYS) {
    const slots = (value as Record<string, unknown>)[key];
    if (!Array.isArray(slots)) continue;
    const ok = slots
      .filter((s): s is { open: string; close: string } => Boolean(s) && TIME_RE.test((s as { open?: string }).open ?? "") && TIME_RE.test((s as { close?: string }).close ?? ""))
      .map((s) => ({ open: s.open, close: s.close }));
    if (ok.length) out[key] = ok;
  }
  return Object.keys(out).length ? out : null;
}

function localDate(d: Date, tz: string) {
  const t = new TZDate(d.getTime(), tz);
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), dow: t.getDay(), h: t.getHours(), min: t.getMinutes() };
}

const iso = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m, d));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

/** Concrete opening intervals overlapping [from, to], merged when they touch. */
export function openIntervals(hours: OpeningHours | null, tz: string, from: Date, to: Date): Interval[] {
  if (!hours) return [];
  const first = localDate(from, tz);
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400_000) + 2;
  const raw: Interval[] = [];
  for (let i = -1; i <= days; i++) {
    const date = iso(first.y, first.m, first.d + i);
    const next = iso(first.y, first.m, first.d + i + 1);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const slot of hours[DAY_KEYS[dow]!] ?? []) {
      if (!TIME_RE.test(slot.open) || !TIME_RE.test(slot.close)) continue;
      const start = localToUtc(date, slot.open, tz);
      const end = slot.close > slot.open ? localToUtc(date, slot.close, tz) : localToUtc(next, slot.close, tz);
      if (end > from && start < to) raw.push({ start, end });
    }
  }
  raw.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const iv of raw) {
    const last = merged.at(-1);
    if (last && iv.start <= last.end) {
      if (iv.end > last.end) last.end = iv.end;
    } else merged.push({ ...iv });
  }
  return merged;
}

export interface OpeningStatus {
  open: boolean;
  /** When it closes (open) — null when open around the clock. */
  closesAt: Date | null;
  /** When it opens next (closed) — null when no opening in the next week. */
  opensAt: Date | null;
  /** "Cierra a las 06:00" · "Abre hoy a las 23:30" · "Abre el viernes a las 23:59" */
  label: string;
  /** "Hoy abierto hasta las 06:00" · "Hoy de 23:30 a 06:00" · "Hoy cerrado" */
  todayLabel: string;
}

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function hhmm(d: Date, tz: string) {
  const l = localDate(d, tz);
  return `${String(l.h).padStart(2, "0")}:${String(l.min).padStart(2, "0")}`;
}

/** "hoy", "mañana", "el viernes" — by calendar day in `tz`. */
function dayPhrase(target: Date, now: Date, tz: string) {
  const a = localDate(now, tz);
  const b = localDate(target, tz);
  const diff = Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86400_000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  return `el ${WEEKDAY_NAMES[b.dow]}`;
}

/**
 * Live status from the weekly schedule, the current time and the venue's
 * timezone (never from a stored "open now" flag). null = hours unknown.
 */
export function openingStatus(hours: OpeningHours | null, tz: string, now = new Date()): OpeningStatus | null {
  const clean = sanitizeHours(hours);
  if (!clean) return null;
  const intervals = openIntervals(clean, tz, new Date(now.getTime() - 2 * 86400_000), new Date(now.getTime() + 8 * 86400_000));
  const current = intervals.find((iv) => iv.start <= now && now < iv.end) ?? null;
  const next = intervals.find((iv) => iv.start > now) ?? null;

  let label: string;
  let closesAt: Date | null = null;
  if (current) {
    const allWeek = current.end.getTime() - now.getTime() > 7 * 86400_000;
    closesAt = allWeek ? null : current.end;
    const phrase = closesAt ? dayPhrase(closesAt, now, tz) : "";
    label = !closesAt ? "Abierto 24 horas" : closesAt.getTime() - now.getTime() <= 24 * 3600_000 ? `Cierra a las ${hhmm(closesAt, tz)}` : `Cierra ${phrase} a las ${hhmm(closesAt, tz)}`;
  } else {
    label = next ? `Abre ${dayPhrase(next.start, now, tz)} a las ${hhmm(next.start, tz)}` : "Cerrado";
  }

  // Today's line (calendar day in the venue's timezone).
  const today = localDate(now, tz);
  const todayIso = iso(today.y, today.m, today.d);
  const isToday = (d: Date) => {
    const l = localDate(d, tz);
    return iso(l.y, l.m, l.d) === todayIso;
  };
  const laterToday = next && isToday(next.start) ? next : null;
  const endedToday = intervals.some((iv) => iv.end <= now && isToday(iv.end));
  let todayLabel: string;
  if (current) todayLabel = closesAt ? `Hoy abierto hasta las ${hhmm(closesAt, tz)}` : "Hoy abierto 24 horas";
  else if (laterToday) todayLabel = `Hoy de ${hhmm(laterToday.start, tz)} a ${hhmm(laterToday.end, tz)}`;
  else todayLabel = endedToday ? "Hoy ya ha cerrado" : "Hoy cerrado";

  return { open: Boolean(current), closesAt, opensAt: current ? null : (next?.start ?? null), label, todayLabel };
}

export function isOpenNow(hours: OpeningHours | null, tz: string, now = new Date()): boolean {
  return openingStatus(hours, tz, now)?.open ?? false;
}

/** Does the venue open at some point in [from, to)? */
export function opensDuring(hours: OpeningHours | null, tz: string, from: Date, to: Date): boolean {
  return openIntervals(sanitizeHours(hours), tz, from, to).length > 0;
}

/** The day key whose row should be highlighted as "today". */
export function todayKey(tz: string, now = new Date()): DayKey {
  return DAY_KEYS[localDate(now, tz).dow]!;
}

// ─── OpenStreetMap opening_hours ─────────────────────────────────────────────

const OSM_DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function osmDays(sel: string): number[] | null {
  const out = new Set<number>();
  for (const part of sel.split(",")) {
    const range = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!range) return null;
    const a = OSM_DAYS[range[1]!]!;
    const b = range[2] ? OSM_DAYS[range[2]]! : a;
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === b) break;
    }
  }
  return [...out];
}

function osmTime(t: string): string | null {
  const m = t.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 48) return null;
  return `${String(h % 24).padStart(2, "0")}:${m[2]}`;
}

/**
 * Parses the common subset of OSM `opening_hours`
 * ("Mo-Fr 18:00-02:00; Sa,Su 20:00-06:00", "Fr,Sa 23:59-06:00", "24/7",
 * "Th-Sa 23:30-05:00; PH off"). Anything it does not fully understand
 * (months, dates, sunset, open ends "+", comments…) returns null: hours are
 * never guessed.
 */
export function parseOsmOpeningHours(value: string | null | undefined): OpeningHours | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text.length > 300) return null;
  if (text === "24/7") return Object.fromEntries(DAY_KEYS.map((k) => [k, [{ open: "00:00", close: "00:00" }]]));

  const week = new Map<number, Array<{ open: string; close: string }>>();
  for (const rawRule of text.split(";")) {
    const rule = rawRule.trim();
    if (!rule) continue;
    if (/^PH\b|^SH\b/.test(rule)) continue; // public/school holiday exceptions: not modelled
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? osmDays(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    const rest = m[2]!.trim();
    if (!days) return null;
    if (rest === "off" || rest === "closed") {
      for (const d of days) week.set(d, []);
      continue;
    }
    const slots: Array<{ open: string; close: string }> = [];
    for (const span of rest.split(",")) {
      const t = span.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
      if (!t) return null;
      const open = osmTime(t[1]!);
      const close = osmTime(t[2]!);
      if (!open || !close || Number(t[1]!.split(":")[0]) > 23) return null;
      slots.push({ open, close });
    }
    if (!slots.length) return null;
    for (const d of days) week.set(d, slots); // later rules override earlier ones
  }
  const out: OpeningHours = {};
  for (const [d, slots] of week) if (slots.length) out[DAY_KEYS[d]!] = slots;
  return Object.keys(out).length ? out : null;
}

/** Google Places `regularOpeningHours.periods` → weekly hours. */
export function hoursFromGooglePeriods(
  periods: Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }> | undefined,
): OpeningHours | null {
  const pad = (n?: number) => String(n ?? 0).padStart(2, "0");
  const out: OpeningHours = {};
  for (const p of periods ?? []) {
    if (p.open?.day == null) continue;
    const key = DAY_KEYS[p.open.day]!;
    // No close = open around the clock.
    (out[key] ??= []).push({ open: `${pad(p.open.hour)}:${pad(p.open.minute)}`, close: p.close ? `${pad(p.close.hour)}:${pad(p.close.minute)}` : `${pad(p.open.hour)}:${pad(p.open.minute)}` });
  }
  return sanitizeHours(out);
}

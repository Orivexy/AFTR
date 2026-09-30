import type { OpeningHours } from "@/lib/types";
import type { ExternalVenue } from "../types";

/**
 * Parser for Barcelona City Council open data "Espais de música i copes"
 * (CKAN datastore, CC BY 4.0, updated weekly): clubs, music bars, cocktail
 * bars… with address, coordinates, phone and official opening hours. One
 * row per place × phone × category, grouped here by register_id. Pure and
 * unit-tested; hours are only kept when they read unambiguously.
 */
export interface BcnRow {
  register_id?: string;
  name?: string;
  addresses_road_name?: string;
  addresses_start_street_number?: string | number | null;
  addresses_neighborhood_name?: string;
  addresses_town?: string;
  geo_epgs_4326_lat?: string | number;
  geo_epgs_4326_lon?: string | number;
  values_category?: string;
  values_attribute_name?: string;
  values_value?: string;
  secondary_filters_name?: string;
  timetable?: string;
}

export const BCN_MUSIC_VENUES_RESOURCE = "062da2e7-ddc9-4659-807a-2c1c5918b73c";
export const BCN_DATASET_URL = "https://opendata-ajuntament.barcelona.cat/data/es/dataset/culturailleure-espaismusicacopes";

/** Only clubs and music bars; restaurants, cocktail/champagne bars and flamenco dinner shows are left out. */
const TYPE_BY_FILTER: Record<string, string> = {
  Discoteques: "nightclub",
  "Sales de festes": "nightclub",
  "Salons de ball": "dance_club",
  "Bars i pubs musicals": "music_bar",
  Karaokes: "music_bar",
};
/** Most specific first: a club that is also listed as a bar stays a club. */
const TYPE_RANK = ["nightclub", "dance_club", "live_music_venue", "music_bar"];

const ROAD_TYPES: Array<[RegExp, string]> = [
  [/^C\s/, "Carrer "], [/^Pg\s/, "Passeig "], [/^Av\s/, "Avinguda "], [/^Pl\s/, "Plaça "], [/^Rbla\s/, "Rambla "],
  [/^Ptge\s/, "Passatge "], [/^Gv\s/, "Gran Via "], [/^Trav\s/, "Travessera "], [/^Rda\s/, "Ronda "], [/^Bda\s/, "Baixada "], [/^Ctra\s/, "Carretera "],
];

const DAYS: Array<[string, keyof OpeningHours]> = [
  ["dilluns", "mon"], ["dimarts", "tue"], ["dimecres", "wed"], ["dijous", "thu"], ["divendres", "fri"], ["dissabte", "sat"], ["diumenge", "sun"],
];
const ORDER = DAYS.map(([, k]) => k);

function decode(html: string) {
  return html.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** "Divendres i dissabte", "De dijous a dissabte", "Tots els dies" → day keys (null when unreadable). */
export function parseCatalanDays(text: string): Array<keyof OpeningHours> | null {
  const t = text.toLowerCase();
  if (/tots els dies|cada dia|diari/.test(t)) return [...ORDER];
  const out = new Set<keyof OpeningHours>();
  const key = (w: string) => DAYS.find(([n]) => n === w)?.[1];
  let rest = t;
  for (const m of t.matchAll(/(dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge)\s+a\s+(dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge)/g)) {
    const a = ORDER.indexOf(key(m[1]!)!);
    const b = ORDER.indexOf(key(m[2]!)!);
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(ORDER[i]!);
      if (i === b) break;
    }
    rest = rest.replace(m[0], " ");
  }
  for (const m of rest.matchAll(/dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge/g)) out.add(key(m[0])!);
  return out.size ? ORDER.filter((d) => out.has(d)) : null;
}

/** Official timetable table (Catalan) → weekly hours; null if any row is unreadable. */
export function parseBcnTimetable(html: string | undefined): OpeningHours | null {
  if (!html) return null;
  const rows = [...html.matchAll(/<tr>\s*<td[^>]*timetable-day[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*timetable-hour[^>]*>([\s\S]*?)<\/td>/g)];
  if (!rows.length) return null;
  const hours: OpeningHours = {};
  for (const [, dayHtml, hourHtml] of rows) {
    const days = parseCatalanDays(decode(dayHtml!));
    const text = decode(hourHtml!).toLowerCase();
    if (!days) return null;
    if (/tancat/.test(text)) continue;
    const slots = [...text.matchAll(/de (\d{1,2})[.:](\d{2}) ?h a (\d{1,2})[.:](\d{2}) ?h/g)].map((m) => ({
      open: `${m[1]!.padStart(2, "0")}:${m[2]}`,
      close: `${m[3]!.padStart(2, "0")}:${m[4]}`,
    }));
    if (!slots.length || slots.some((s) => Number(s.open.slice(0, 2)) > 23 || Number(s.close.slice(0, 2)) > 24)) return null;
    for (const d of days) hours[d] = [...(hours[d] ?? []), ...slots.map((s) => ({ ...s, close: s.close === "24:00" ? "00:00" : s.close }))];
  }
  return Object.keys(hours).length ? hours : null;
}

function address(road: string | undefined, number: BcnRow["addresses_start_street_number"]) {
  if (!road?.trim()) return null;
  let r = road.trim();
  for (const [re, full] of ROAD_TYPES) if (re.test(r)) r = r.replace(re, full);
  const n = number == null || number === "" ? "" : ` ${String(number).replace(/\.0+$/, "")}`;
  return `${r}${n}`;
}

export function parseBcnMusicVenues(records: unknown): { venues: ExternalVenue[]; skipped: number } {
  if (!Array.isArray(records)) throw new Error("Formato inesperado: se esperaba una lista de registros");
  const groups = new Map<string, BcnRow[]>();
  for (const r of records as BcnRow[]) {
    const id = r.register_id?.replace(/^﻿/, "").trim();
    if (!id) continue;
    groups.set(id, [...(groups.get(id) ?? []), r]);
  }
  const venues: ExternalVenue[] = [];
  let skipped = 0;
  for (const [id, rows] of groups) {
    const first = rows[0]!;
    const types = [...new Set(rows.map((r) => TYPE_BY_FILTER[r.secondary_filters_name?.trim() ?? ""]).filter((t): t is string => Boolean(t)))];
    const lat = Number(first.geo_epgs_4326_lat);
    const lng = Number(first.geo_epgs_4326_lon);
    const restaurant = rows.some((r) => r.secondary_filters_name?.trim() === "Restaurants") && !types.includes("nightclub");
    if (!first.name?.trim() || !types.length || restaurant || !Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) {
      skipped++;
      continue;
    }
    const phone = rows.find((r) => r.values_category === "Telèfons" && r.values_value?.trim() && !/no tenen/i.test(r.values_attribute_name ?? ""))?.values_value?.trim();
    venues.push({
      externalId: `bcn-${id}`,
      name: first.name.trim(),
      address: address(first.addresses_road_name, first.addresses_start_street_number),
      city: "Barcelona",
      lat,
      lng,
      phone: phone ?? null,
      types: types.sort((a, b) => TYPE_RANK.indexOf(a) - TYPE_RANK.indexOf(b)).slice(0, 1),
      openingHours: parseBcnTimetable(rows.find((r) => r.timetable)?.timetable),
      sourceUrl: BCN_DATASET_URL,
    });
  }
  return { venues, skipped };
}

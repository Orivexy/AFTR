import type { ExternalEvent } from "../types";

/**
 * Parser for the Madrid open-data agenda (JSON-LD-like `@graph`). Pure and
 * unit-tested. Nothing is guessed: a missing time stays unknown, a missing
 * price stays null ("free" comes from the dataset's own flag).
 */
interface MadridItem {
  "@type"?: string;
  id?: string;
  uid?: string;
  title?: string;
  description?: string;
  free?: number | string;
  price?: string;
  dtstart?: string;
  dtend?: string;
  time?: string;
  audience?: string;
  link?: string;
  "event-location"?: string;
  address?: { area?: { "street-address"?: string; locality?: string; "postal-code"?: string } };
  location?: { latitude?: number; longitude?: number };
  organization?: { "organization-name"?: string };
}

/** Dataset types (last path segment of @type) that fit a nightlife agenda. */
const TYPE_HINTS: Array<[RegExp, string]> = [
  [/\/actividades\/Fiestas\b/, "fiesta mayor"],
  [/\/actividades\/Musica\b/, "concierto"],
  [/\/actividades\/DanzaBaile\b/, "fiesta"],
  [/\/actividades\/Ferias\b/, "festival"],
];

const MAX_SPAN_DAYS = 14;

/** "8 €", "Entrada: 10 euros", "De 12 a 18 €" → cents (min/max). Unparseable → null. */
export function parsePriceText(text: string | undefined): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };
  const clean = text.replace(/(\d)\.(\d{3})/g, "$1$2");
  const cents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
  const nums = [...clean.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur\b)/gi)].map((m) => cents(m[1]!));
  // Ranges written once: "de 12 a 18 €", "12-18 €".
  for (const m of clean.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:a|-|–|y|i|o)\s*\d+(?:[.,]\d{1,2})?\s*(?:€|euros?|eur\b)/gi)) nums.push(cents(m[1]!));
  const valid = nums.filter((n) => n >= 0 && n <= 100_000);
  if (!valid.length) return { min: null, max: null };
  return { min: Math.min(...valid), max: Math.max(...valid) };
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s,/-])([\p{L}])/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

export function parseMadridAgenda(json: unknown, tz: string): { events: ExternalEvent[]; skipped: number } {
  const graph = (json as { "@graph"?: MadridItem[] })?.["@graph"];
  if (!Array.isArray(graph)) throw new Error("Formato inesperado: falta @graph");
  const events: ExternalEvent[] = [];
  let skipped = 0;
  for (const it of graph) {
    const hint = TYPE_HINTS.find(([re]) => re.test(it["@type"] ?? ""))?.[1];
    const date = it.dtstart?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const endDate = it.dtend?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const id = it.id || it.uid;
    const childrenOnly = /niñ|famil|infantil|bebé/i.test(it.audience ?? "") && !/joven|adult/i.test(it.audience ?? "");
    if (!hint || !date || !id || !it.title || childrenOnly) {
      skipped++;
      continue;
    }
    const spanDays = endDate ? (Date.parse(endDate) - Date.parse(date)) / 86_400_000 : 0;
    if (spanDays > MAX_SPAN_DAYS) {
      skipped++; // long-running programmes (courses, seasons) are not "a night out"
      continue;
    }
    const time = it.time?.match(/^(\d{1,2}):(\d{2})/);
    const hhmm = time ? `${time[1]!.padStart(2, "0")}:${time[2]}` : null;
    const free = String(it.free) === "1";
    const price = free ? { min: 0, max: 0 } : parsePriceText(it.price);
    const street = it.address?.area?.["street-address"];
    const lat = it.location?.latitude;
    const lng = it.location?.longitude;
    events.push({
      externalId: String(id),
      title: it.title.trim(),
      description: it.description?.trim() || null,
      start: { kind: "local", date, time: hhmm, tz },
      end: endDate && endDate !== date ? { kind: "local", date: endDate, time: null, tz } : null,
      place: {
        name: it["event-location"]?.trim() || it.organization?.["organization-name"]?.trim() || null,
        address: street ? titleCase(street) : null,
        city: it.address?.area?.locality ? titleCase(it.address.area.locality) : "Madrid",
        lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
        lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
      },
      priceMin: price.min,
      priceMax: price.max,
      currency: price.min != null ? "EUR" : null,
      isFree: free,
      officialUrl: it.link ?? null,
      sourceUrl: it.link ?? null,
      organizerName: it.organization?.["organization-name"]?.trim() || null,
      categoryHint: hint,
    });
  }
  return { events, skipped };
}

import type { ExternalEvent } from "../types";
import { parsePriceText } from "./madrid-agenda";

/**
 * Parser for the Generalitat de Catalunya open-data "Agenda cultural de
 * Catalunya" (Socrata dataset rhpv-yr4f, updated daily). Pure and
 * unit-tested. Only night-out activities are kept: parties, popular
 * festivities (festes majors, revetlles…), concerts and festivals — never
 * opera, classical music, theatre or children's shows. The engine then
 * keeps concerts only when they happen at a club (config.nightlifeOnly). Nothing is
 * guessed: an unreadable time stays unknown, an unreadable price stays null.
 */
export interface CataloniaItem {
  codi?: string;
  denominaci?: string;
  subt_tol?: string;
  descripcio?: string;
  data_inici?: string;
  data_fi?: string;
  horari?: string;
  entrades?: string;
  gratuita?: string;
  linkbotoentrades?: string;
  url?: string;
  enlla_os?: string;
  imatges?: string;
  tags_categor_es?: string;
  tags_mbits?: string;
  espai?: string;
  adre_a?: string;
  localitat?: string;
  latitud?: string;
  longitud?: string;
}

export const CATALONIA_AGENDA_URL = "https://analisi.transparenciacatalunya.cat/resource/rhpv-yr4f.json";
export const BARCELONA_MUNICIPALITY = "agenda:ubicacions/barcelona/barcelones/barcelona";
const IMAGE_BASE = "https://agenda.cultura.gencat.cat";
const MAX_SPAN_DAYS = 14;

const NIGHT_CATEGORIES = /categories\/(concerts|festivals|festes|revetll|carnaval|cultura-popular|nit)|ambits\/tradicional-i-popular/;
const NIGHT_TITLE = /\b(festa|fiesta|revetlla|verbena|dj|nit de|party|sessi[oó] de)\b/i;
const EXCLUDED = /categories\/(infantil|exposicions|conferencies|cursos|rutes|activitats-virtuals|llibres|cinema|teatre|opera|magia|circ)/;
/** Classical music, opera and seated recitals are not a night out. */
const NOT_NIGHTLIFE = /\b(òpera|opera|simf[oò]ni|orquestra|orfe[oó]|cambra|recital|lied|sarsuela|zarzuela|coral|piano|violí|violoncel|quartet|missa|requiem|barroc|cl[aà]ssica)\b|palau de la m[uú]sica|liceu|l'auditori/i;

/** "20.30 h", "A les 21 h", "De 18 a 23 h", "22:00" → "HH:MM" of the start, else null. */
export function parseStartTime(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const pad = (h: string, m?: string) => (Number(h) > 23 || Number(m ?? 0) > 59 ? null : `${h.padStart(2, "0")}:${m ?? "00"}`);
  const range = t.match(/\bde (\d{1,2})(?:[.:](\d{2}))?\s*(?:h\s*)?a\s*\d{1,2}/);
  if (range) return pad(range[1]!, range[2]);
  const single = t.match(/\b(\d{1,2})(?:[.:](\d{2}))?\s*h\b/) ?? t.match(/\b(\d{1,2})[:](\d{2})\b/);
  return single ? pad(single[1]!, single[2]) : null;
}

function firstUrl(...values: Array<string | undefined>): string | null {
  for (const v of values) {
    const m = v?.match(/https?:\/\/[^\s,;"]+/);
    if (m) return m[0];
  }
  return null;
}

export function parseCataloniaAgenda(items: unknown, tz: string): { events: ExternalEvent[]; skipped: number } {
  if (!Array.isArray(items)) throw new Error("Formato inesperado: se esperaba una lista");
  const events: ExternalEvent[] = [];
  let skipped = 0;
  for (const it of items as CataloniaItem[]) {
    const cats = `${it.tags_categor_es ?? ""} ${it.tags_mbits ?? ""}`;
    const rawTitle = it.denominaci?.trim() ?? "";
    const cancelled = /^activitat cancel·lada/i.test(rawTitle);
    const postponed = /^activitat ajornada/i.test(rawTitle);
    const title = rawTitle.replace(/^activitat (cancel·lada|ajornada)\s*/i, "").trim();
    const date = it.data_inici?.slice(0, 10);
    const endDate = it.data_fi?.slice(0, 10);
    const wanted = (NIGHT_CATEGORIES.test(cats) || NIGHT_TITLE.test(title)) && !EXCLUDED.test(cats);
    const classical = NOT_NIGHTLIFE.test(`${title} ${it.subt_tol ?? ""} ${it.espai ?? ""}`);
    if (!it.codi || !title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !wanted || classical || postponed) {
      skipped++;
      continue;
    }
    const spanDays = endDate ? (Date.parse(endDate) - Date.parse(date)) / 86_400_000 : 0;
    if (spanDays > MAX_SPAN_DAYS) {
      skipped++; // seasons and long runs are not "a night out"
      continue;
    }
    const free = /^s[ií]/i.test(it.gratuita ?? "") || (/(gratu[iï]t|entrada lliure|gratis)/i.test(it.entrades ?? "") && !/\d\s*(€|euros?)/i.test(it.entrades ?? ""));
    const price = free ? { min: 0, max: 0 } : parsePriceText(it.entrades);
    const lat = Number(it.latitud);
    const lng = Number(it.longitud);
    const image = it.imatges?.split(",")[0]?.trim();
    const hint = /festes|revetll|carnaval|cultura-popular|tradicional-i-popular/.test(cats) || /festa major|festes de/i.test(title)
      ? "festa major"
      : /festivals/.test(cats)
        ? "festival"
        : /concerts/.test(cats)
          ? "concierto"
          : "fiesta";
    events.push({
      externalId: it.codi,
      title: it.subt_tol?.trim() && title.length < 40 ? `${title} · ${it.subt_tol.trim()}` : title,
      description: it.descripcio?.replace(/Darrera actualització: [\d/]+\s*$/, "").trim() || null,
      start: { kind: "local", date, time: parseStartTime(it.horari), tz },
      end: endDate && endDate !== date ? { kind: "local", date: endDate, time: null, tz } : null,
      place: {
        name: it.espai?.trim() || null,
        address: it.adre_a?.trim() || null,
        city: it.localitat?.trim() || "Barcelona",
        lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
        lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      },
      priceMin: price.min,
      priceMax: price.max,
      currency: price.min != null ? "EUR" : null,
      isFree: free,
      ticketUrl: firstUrl(it.linkbotoentrades),
      officialUrl: firstUrl(it.enlla_os, it.url),
      sourceUrl: firstUrl(it.linkbotoentrades, it.enlla_os, it.url),
      organizerName: null,
      categoryHint: hint,
      imageUrls: image ? [`${IMAGE_BASE}${encodeURI(image.startsWith("/") ? image : `/${image}`)}`] : [],
      cancelled,
    });
  }
  return { events, skipped };
}

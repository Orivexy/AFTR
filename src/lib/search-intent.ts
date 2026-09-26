import { normalizeSearch } from "./text";
import type { TypeFilter, WhenFilter } from "./map-filters";

/**
 * Understands searches like "fiesta hoy", "techno", "clubs cerca de mí",
 * "Razzmatazz" or "Barcelona": date words, "near me", "free", types and
 * genres become filters; the rest is free text.
 */
export interface SearchIntent {
  text: string;
  when: Exclude<WhenFilter, "all"> | null;
  near: boolean;
  free: boolean;
  genres: string[];
  types: TypeFilter[];
  /** City named in the query (slug), if any. */
  city: string | null;
}

const PHRASES: Array<[RegExp, (i: SearchIntent) => void]> = [
  [/\b(esta noche|tonight|hoy|ahora)\b/, (i) => (i.when = "today")],
  [/\b(manana|tomorrow)\b/, (i) => (i.when = "tomorrow")],
  [/\b(este finde|fin de semana|finde|weekend)\b/, (i) => (i.when = "weekend")],
  [/\b(esta semana|7 dias|proximos dias|semana)\b/, (i) => (i.when = "week")],
  [/\b(cerca de mi|cerca de aqui|cerca|near me|nearby|alrededor)\b/, (i) => (i.near = true)],
  [/\b(gratis|gratuit[oa]s?|free|sin entrada)\b/, (i) => (i.free = true)],
];

const TYPES: Array<[RegExp, TypeFilter]> = [
  [/\b(clubs?|discotecas?|disco|boliches?|nightclubs?)\b/, "club"],
  [/\b(fiestas?|party|parties|festa)\b/, "fiesta"],
  [/\b(festivales|festival)\b/, "festival"],
  [/\b(conciertos?|concerts?|directo|en vivo)\b/, "concierto"],
  [/\b(eventos?|events?|planes?)\b/, "evento"],
];

const GENRES: Array<[RegExp, string]> = [
  [/\b(techno|tekno)\b/, "techno"],
  [/\b(house|tech house|deep house)\b/, "house"],
  [/\b(reggaeton|regueton|perreo)\b/, "reggaeton"],
  [/\b(hip ?hop|rap|trap)\b/, "hip-hop"],
  [/\b(edm)\b/, "edm"],
  [/\b(electronica|electronic)\b/, "electronica"],
  [/\b(comercial|commercial)\b/, "comercial"],
  [/\b(latin[oa]?|salsa|bachata)\b/, "latin"],
  [/\b(indie|rock)\b/, "indie"],
];

const STOP = new Set(["de", "en", "mi", "para", "la", "el", "los", "las", "que", "hay", "a", "y", "por", "con", "del", "me", "un", "una", "algo"]);

export function parseSearchIntent(raw: string, cities: Array<{ slug: string; name: string }> = []): SearchIntent {
  let q = ` ${normalizeSearch(raw)} `;
  const intent: SearchIntent = { text: "", when: null, near: false, free: false, genres: [], types: [], city: null };
  const strip = (re: RegExp) => (q = q.replace(new RegExp(re.source, "g"), " "));

  for (const [re, apply] of PHRASES) if (re.test(q)) (apply(intent), strip(re));
  for (const [re, type] of TYPES) if (re.test(q)) (intent.types.push(type), strip(re));
  for (const [re, genre] of GENRES) if (re.test(q)) (intent.genres.push(genre), strip(re));
  for (const c of cities) {
    const name = normalizeSearch(c.name);
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (name && re.test(q)) {
      intent.city = c.slug;
      strip(re);
    }
  }
  intent.text = q.split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ");
  return intent;
}

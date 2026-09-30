/**
 * Kinds of place and filters of the nightlife section (shared by the
 * venues page, the agenda and the map).
 */
export const VENUE_TYPE_LABEL: Record<string, string> = {
  DISCO: "Discoteca",
  CLUB: "Club",
  CONCERT_HALL: "Sala de conciertos",
  EVENT_SPACE: "Sala de eventos",
  FESTIVAL_SPACE: "Espacio para festivales",
  OPEN_AIR: "Espacio al aire libre",
  BAR: "Bar musical",
  OTHER: "Otro",
};

export const VENUE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierto",
  TEMPORARILY_CLOSED: "Cerrado temporalmente",
  PERMANENTLY_CLOSED: "Cerrado definitivamente",
};

export type NightlifeFilter = "todos" | "discotecas" | "clubs" | "conciertos" | "fiestas" | "festivales" | "eventos";

export const NIGHTLIFE_FILTERS: Array<{ value: NightlifeFilter; label: string; venueTypes?: string[]; categories?: string[] }> = [
  { value: "todos", label: "Todos" },
  { value: "discotecas", label: "Discotecas", venueTypes: ["DISCO"] },
  { value: "clubs", label: "Clubs", venueTypes: ["CLUB"] },
  { value: "conciertos", label: "Conciertos", venueTypes: ["CONCERT_HALL"], categories: ["concierto"] },
  { value: "fiestas", label: "Fiestas", venueTypes: ["DISCO", "CLUB"], categories: ["fiesta", "discoteca", "dj", "tematica"] },
  { value: "festivales", label: "Festivales", venueTypes: ["FESTIVAL_SPACE"], categories: ["festival"] },
  { value: "eventos", label: "Eventos", venueTypes: ["EVENT_SPACE", "OPEN_AIR", "OTHER"], categories: ["especial", "tematica", "otro"] },
];

export function nightlifeFilter(value: string | undefined) {
  return NIGHTLIFE_FILTERS.find((f) => f.value === value) ?? NIGHTLIFE_FILTERS[0]!;
}

/** Events shown for a filter: by kind of event, or by kind of place when the filter is about places. */
export function eventFilterFor(value: string | undefined): { categories?: string[]; venueTypes?: string[] } {
  const f = nightlifeFilter(value);
  if (f.value === "discotecas" || f.value === "clubs") return { venueTypes: f.venueTypes };
  return f.categories ? { categories: f.categories } : {};
}

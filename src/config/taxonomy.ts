/**
 * Canonical categories and music genres. The database is seeded from these
 * lists; the UI reads them from the database so new ones can be added later.
 */
export const CATEGORIES = [
  { slug: "fm", name: "FM", emoji: "🎪" },
  { slug: "fiesta", name: "Fiesta", emoji: "🎉" },
  { slug: "discoteca", name: "Discoteca", emoji: "🪩" },
  { slug: "concierto", name: "Concierto", emoji: "🎤" },
  { slug: "dj", name: "DJ", emoji: "🎧" },
  { slug: "festival", name: "Festival", emoji: "🎡" },
  { slug: "otro", name: "Otro", emoji: "✨" },
] as const;

export const GENRES = [
  { slug: "reggaeton", name: "Reggaeton" },
  { slug: "techno", name: "Techno" },
  { slug: "house", name: "House" },
  { slug: "hip-hop", name: "Hip Hop" },
  { slug: "comercial", name: "Comercial" },
  { slug: "electronica", name: "Electrónica" },
  { slug: "edm", name: "EDM" },
  { slug: "latin", name: "Latin" },
  { slug: "indie", name: "Indie" },
  { slug: "otro", name: "Otro" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export type GenreSlug = (typeof GENRES)[number]["slug"];

export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "INAPPROPRIATE", label: "Contenido inapropiado" },
  { value: "HARASSMENT", label: "Acoso" },
  { value: "FAKE_EVENT", label: "Evento falso" },
  { value: "WRONG_INFO", label: "Información incorrecta" },
  { value: "OTHER", label: "Otro" },
] as const;

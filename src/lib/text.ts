/** Lower-case and strip diacritics so "Gràcia" matches "gracia". */
export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds the `searchText` column value from any number of fields. */
export function buildSearchText(...parts: Array<string | null | undefined>): string {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

export function slugify(input: string): string {
  return normalizeSearch(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Normalises user-provided text: removes control characters (except new
 * lines), collapses runs of blank lines and trims. React escapes output, so
 * this is about data hygiene rather than XSS.
 */
export function cleanText(input: string): string {
  return input
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

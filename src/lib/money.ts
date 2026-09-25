export function formatPrice(
  priceMin: number | null | undefined,
  priceMax?: number | null,
  currency = "EUR",
): string {
  if (priceMin == null) return "Precio por confirmar";
  if (priceMin === 0 && !priceMax) return "Gratis";
  const fmt = (cents: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  if (priceMax && priceMax > priceMin) {
    return priceMin === 0 ? `Gratis – ${fmt(priceMax)}` : `${fmt(priceMin)} – ${fmt(priceMax)}`;
  }
  return fmt(priceMin);
}

export function isFree(priceMin: number | null | undefined): boolean {
  return priceMin === 0;
}

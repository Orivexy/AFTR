/**
 * Quality gate before auto-publishing. Returns the reasons an item needs a
 * human; an empty list means it can be published automatically.
 */
import { distanceKm } from "@/lib/geo";
import type { NormalizedEvent } from "./types";

export interface QualityContext {
  now: Date;
  city: { name: string; lat: number; lng: number; searchRadiusKm: number };
}

/** Items that ended already are dropped entirely (not queued). */
export function isExpired(e: NormalizedEvent, now: Date): boolean {
  const end = e.endsAt ? new Date(e.endsAt) : new Date(new Date(e.startsAt).getTime() + 6 * 3600_000);
  return end < now;
}

export function qualityIssues(e: NormalizedEvent, ctx: QualityContext): string[] {
  const issues: string[] = [];
  if (e.title.length < 3 || !/[\p{L}\d]/u.test(e.title)) issues.push("Título no válido");
  if (e.timeUnknown) issues.push("Sin hora de inicio");
  const start = new Date(e.startsAt);
  if (start.getTime() > ctx.now.getTime() + 365 * 24 * 3600_000) issues.push("Fecha demasiado lejana");
  if (e.endsAt && new Date(e.endsAt).getTime() - start.getTime() > 4 * 24 * 3600_000) issues.push("Duración sospechosa");
  if (e.lat == null || e.lng == null) issues.push("Ubicación desconocida");
  else if (distanceKm(ctx.city, { lat: e.lat, lng: e.lng }) > ctx.city.searchRadiusKm) issues.push(`Fuera del área de ${ctx.city.name}`);
  if (!e.locationName && !e.address) issues.push("Sin lugar");
  return issues;
}

import "server-only";
import { db } from "../db";
import { env } from "../env";

/**
 * Request accounting for external APIs with quotas or per-request cost.
 * Every call goes through `withQuota`, which refuses to call the provider
 * once today's cap is reached (the sync then fails and backs off; the app
 * keeps serving what is already in the database).
 */
export type ApiProvider = "overpass" | "google_places" | "ticketmaster";

export class QuotaExceededError extends Error {}

const LIMITS: Record<ApiProvider, () => number> = {
  overpass: () => env.OVERPASS_DAILY_LIMIT,
  google_places: () => env.GOOGLE_PLACES_DAILY_LIMIT,
  ticketmaster: () => env.TICKETMASTER_DAILY_LIMIT,
};

/** UTC day bucket. */
export function usageDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function bump(provider: ApiProvider, field: "requests" | "errors") {
  const day = usageDay();
  await db.apiUsage.upsert({
    where: { provider_day: { provider, day } },
    create: { provider, day, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

export async function withQuota<T>(provider: ApiProvider, call: () => Promise<T>): Promise<T> {
  const limit = LIMITS[provider]();
  const today = await db.apiUsage.findUnique({ where: { provider_day: { provider, day: usageDay() } }, select: { requests: true } });
  if ((today?.requests ?? 0) >= limit) throw new QuotaExceededError(`Límite diario de ${provider} alcanzado (${limit} peticiones)`);
  await bump(provider, "requests");
  try {
    return await call();
  } catch (err) {
    await bump(provider, "errors").catch(() => {});
    throw err;
  }
}

export async function usageSummary(days = 30) {
  const since = usageDay(new Date(Date.now() - (days - 1) * 86400_000));
  const rows = await db.apiUsage.findMany({ where: { day: { gte: since } }, orderBy: { day: "desc" } });
  const today = usageDay().getTime();
  return (Object.keys(LIMITS) as ApiProvider[]).map((provider) => {
    const mine = rows.filter((r) => r.provider === provider);
    const requests = mine.reduce((a, r) => a + r.requests, 0);
    const costPer1000 = provider === "google_places" ? env.GOOGLE_PLACES_COST_PER_1000 : undefined;
    return {
      provider,
      limitPerDay: LIMITS[provider](),
      today: mine.find((r) => r.day.getTime() === today)?.requests ?? 0,
      requests,
      errors: mine.reduce((a, r) => a + r.errors, 0),
      /** Only when the operator configured a price; the provider's free tier is not deducted. */
      estimatedCost: costPer1000 != null ? Math.round((requests / 1000) * costPer1000 * 100) / 100 : null,
    };
  });
}

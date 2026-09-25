import "server-only";
import type { PlanCode } from "@prisma/client";
import { db } from "../db";
import { isFeatureEnabled } from "./flags";

/** Feature keys each plan will unlock once premium plans are enabled. */
export const PLAN_FEATURES: Record<PlanCode, string[]> = {
  PLAN_FREE: [],
  PLAN_PREMIUM: ["featured_events", "featured_profile", "stats"],
  PLAN_BUSINESS: ["featured_events", "featured_profile", "stats", "priority_visibility", "organizer_tools"],
};

export const PLAN_FEATURE_LABEL: Record<string, string> = {
  featured_events: "Destacar eventos",
  featured_profile: "Destacar perfil",
  stats: "Estadísticas",
  priority_visibility: "Mayor visibilidad",
  organizer_tools: "Herramientas para organizadores",
};

/**
 * Whether a business can use a premium feature. Always false while premium
 * plans are disabled, and requires an ACTIVE subscription to a plan that
 * includes the feature (the `plan` column alone is never enough).
 */
export async function businessHasFeature(businessId: string, feature: string): Promise<boolean> {
  if (!isFeatureEnabled("premium")) return false;
  const sub = await db.subscription.findFirst({
    where: { businessId, status: { in: ["ACTIVE", "TRIALING"] } },
    select: { plan: { select: { code: true, isActive: true } } },
  });
  return Boolean(sub?.plan.isActive && PLAN_FEATURES[sub.plan.code].includes(feature));
}

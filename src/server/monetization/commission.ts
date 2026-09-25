import "server-only";
import { db } from "../db";
import { ApiError } from "../errors";

/**
 * Picks the active rule for a business (falls back to the global rule).
 * Without any configured rule, sales are impossible — rates are never guessed.
 */
export async function resolveCommissionRule(businessId: string | null, at = new Date()) {
  const window = {
    isActive: true,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: at } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: at } }] },
    ],
  };
  const rule =
    (businessId ? await db.commissionRule.findFirst({ where: { ...window, businessId }, orderBy: { createdAt: "desc" } }) : null) ??
    (await db.commissionRule.findFirst({ where: { ...window, businessId: null }, orderBy: { createdAt: "desc" } }));
  if (!rule) throw new ApiError(409, "No hay comisiones configuradas.", "COMMISSION_NOT_CONFIGURED");
  return rule;
}

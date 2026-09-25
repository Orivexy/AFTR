import { route, parseJson } from "@/server/http";
import { commissionRuleSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

export const POST = route({ auth: "admin" }, async ({ req, user, ip }) => {
  const input = await parseJson(req, commissionRuleSchema);
  const rule = await db.commissionRule.create({ data: input, select: { id: true } });
  await audit({ actorId: user!.id, action: "commission.create", targetType: "COMMISSION_RULE", targetId: rule.id, metadata: { ...input, validFrom: input.validFrom?.toISOString(), validUntil: input.validUntil?.toISOString() }, ip });
  return { rule };
});

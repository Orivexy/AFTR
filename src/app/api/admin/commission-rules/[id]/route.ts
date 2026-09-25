import { route, parseJson } from "@/server/http";
import { commissionRuleSchema } from "@/lib/validators";
import { db } from "@/server/db";

export const PATCH = route<{ id: string }>({ auth: "admin", audit: { action: "commission.update", targetType: "COMMISSION_RULE" } }, async ({ req, params }) => {
  const input = await parseJson(req, commissionRuleSchema.partial());
  return { rule: await db.commissionRule.update({ where: { id: params.id }, data: input, select: { id: true } }) };
});

export const DELETE = route<{ id: string }>({ auth: "admin", audit: { action: "commission.delete", targetType: "COMMISSION_RULE" } }, async ({ params }) => {
  await db.commissionRule.delete({ where: { id: params.id } });
  return { ok: true };
});

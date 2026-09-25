import { route, parseJson } from "@/server/http";
import { planUpdateSchema } from "@/lib/validators";
import { db } from "@/server/db";

/** Edits plan metadata. Activating plans for sale is not possible from here (see flags). */
export const PATCH = route<{ id: string }>({ auth: "admin", audit: { action: "plan.update", targetType: "PLAN" } }, async ({ req, params }) => {
  const input = await parseJson(req, planUpdateSchema);
  return { plan: await db.plan.update({ where: { id: params.id }, data: input, select: { id: true } }) };
});

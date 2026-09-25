import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { db } from "@/server/db";
import { activatePromotion } from "@/server/monetization/promotions";

export const PATCH = route<{ id: string }>({ auth: "admin", audit: { action: "promotion.update", targetType: "PROMOTION" } }, async ({ req, params }) => {
  const { action } = await parseJson(req, z.object({ action: z.enum(["activate", "reject", "delete"]) }));
  if (action === "activate") await activatePromotion(params.id);
  else if (action === "reject") await db.promotion.update({ where: { id: params.id }, data: { status: "REJECTED" } });
  else await db.promotion.deleteMany({ where: { id: params.id, status: { in: ["DRAFT", "REJECTED", "ENDED"] } } });
  return { ok: true };
});

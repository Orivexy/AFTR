import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { setContentVisibility } from "@/server/services/reports";

export const PATCH = route<{ id: string }>({ auth: "moderator", audit: { action: "post.status", targetType: "POST" } }, async ({ req, params }) => {
  const { status } = await parseJson(req, z.object({ status: z.enum(["VISIBLE", "HIDDEN", "REMOVED"]) }));
  await setContentVisibility("POST", params.id, status);
  return { ok: true };
});

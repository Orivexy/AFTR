import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { setReviewHidden } from "@/server/services/venues";

export const PATCH = route<{ id: string }>({ auth: "moderator" }, async ({ req, params }) => {
  const { hidden } = await parseJson(req, z.object({ hidden: z.boolean() }));
  await setReviewHidden(params.id, hidden);
  return { ok: true };
});

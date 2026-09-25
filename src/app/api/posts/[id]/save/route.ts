import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { setPostSaved } from "@/server/services/posts";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { saved } = await parseJson(req, z.object({ saved: z.boolean() }));
  return setPostSaved(user!.id, params.id, saved);
});

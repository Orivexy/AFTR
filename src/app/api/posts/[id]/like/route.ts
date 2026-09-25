import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { setPostLike } from "@/server/services/posts";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { liked } = await parseJson(req, z.object({ liked: z.boolean() }));
  return setPostLike(user!.id, params.id, liked);
});

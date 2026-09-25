import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { setFollow } from "@/server/services/users";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { following } = await parseJson(req, z.object({ following: z.boolean() }));
  return setFollow(user!.id, params.id, following);
});

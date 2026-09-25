import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { togglePhotoLike } from "@/server/services/venues";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { liked } = await parseJson(req, z.object({ liked: z.boolean() }));
  return togglePhotoLike(user!.id, params.id, liked);
});

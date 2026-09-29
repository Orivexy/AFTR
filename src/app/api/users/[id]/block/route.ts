import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { setBlock } from "@/server/services/blocks";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { blocked } = await parseJson(req, z.object({ blocked: z.boolean() }));
  return setBlock(user!.id, params.id, blocked);
});

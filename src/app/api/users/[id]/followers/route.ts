import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { listFollows } from "@/server/services/users";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params, user }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(20).optional() }));
  return listFollows(params.id, "followers", user?.id, cursor);
});

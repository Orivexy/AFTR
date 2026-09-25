import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { userEvents } from "@/server/services/events";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params, user }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(20).optional() }));
  const isSelf = user?.id === params.id || (user != null && user.role !== "USER");
  return userEvents(params.id, { includeUnpublished: isSelf, cursor });
});

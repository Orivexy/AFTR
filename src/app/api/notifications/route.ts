import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { listNotifications } from "@/server/services/notifications";

export const GET = route({ auth: true, rateLimit: "read" }, async ({ req, user }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(40).optional() }));
  return listNotifications(user!.id, cursor);
});

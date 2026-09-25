import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { savedEvents } from "@/server/services/events";
import { listPosts } from "@/server/services/posts";

export const GET = route({ auth: true, rateLimit: "read" }, async ({ req, user }) => {
  const { type, cursor } = parseQuery(req, z.object({ type: z.enum(["events", "posts"]).default("events"), cursor: z.string().max(20).optional() }));
  return type === "events" ? savedEvents(user!.id, cursor) : listPosts({ savedBy: user!.id, viewerId: user!.id, cursor });
});

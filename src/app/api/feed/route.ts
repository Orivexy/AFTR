import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { getFeed } from "@/server/services/posts";
import { getCurrentCity } from "@/server/services/cities";

const q = z.object({
  mode: z.enum(["foryou", "following"]).default("foryou"),
  cursor: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export const GET = route({ rateLimit: "read" }, async ({ req, user }) => {
  const { mode, cursor, limit } = parseQuery(req, q);
  const city = await getCurrentCity();
  return getFeed({ mode, viewerId: user?.id, cityId: city.id, cursor, limit });
});

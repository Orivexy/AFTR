import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { globalSearch } from "@/server/services/search";
import { getCurrentCity } from "@/server/services/cities";

export const GET = route({ rateLimit: "read" }, async ({ req }) => {
  const { q } = parseQuery(req, z.object({ q: z.string().max(100).default("") }));
  const city = await getCurrentCity();
  return globalSearch(q, city.id, 6);
});

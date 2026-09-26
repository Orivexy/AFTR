import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { globalSearch } from "@/server/services/search";
import { getCurrentCity } from "@/server/services/cities";

export const GET = route({ rateLimit: "read" }, async ({ req }) => {
  const { q, lat, lng } = parseQuery(
    req,
    z.object({ q: z.string().max(100).default(""), lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional() }),
  );
  const city = await getCurrentCity();
  return globalSearch(q, city, { limit: 6, coords: lat != null && lng != null ? { lat, lng } : null });
});

import { z } from "zod";
import { route, parseQuery, badRequest } from "@/server/http";
import { listVenues } from "@/server/services/venues";
import { getCityBySlug, getCurrentCity } from "@/server/services/cities";

const q = z.object({
  city: z.string().max(40).optional(),
  genre: z.string().max(100).optional(),
  sort: z.enum(["popular", "rating", "name"]).default("popular"),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.5).max(50).default(5),
  cursor: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(12),
});

export const GET = route({ rateLimit: "read" }, async ({ req }) => {
  const p = parseQuery(req, q);
  const city = p.city ? await getCityBySlug(p.city) : await getCurrentCity();
  if (!city) throw badRequest("Ciudad no válida");
  return listVenues({
    cityId: city.id,
    genres: p.genre?.split(",").filter(Boolean),
    sort: p.sort,
    near: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, radiusKm: p.radius } : undefined,
    cursor: p.cursor,
    limit: p.limit,
  });
});

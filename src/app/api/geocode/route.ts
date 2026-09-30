import { z } from "zod";
import { route, parseQuery, ApiError } from "@/server/http";
import { getCityBySlug, getCurrentCity } from "@/server/services/cities";
import { geocode } from "@/server/services/geocode";

/** Address → coordinates (OpenStreetMap Nominatim), for event and venue forms. */
export const GET = route({ auth: true, rateLimit: "geocode" }, async ({ req }) => {
  const { q, city: slug } = parseQuery(req, z.object({ q: z.string().max(120), city: z.string().max(40).optional() }));
  const city = (slug && (await getCityBySlug(slug))) || (await getCurrentCity());
  try {
    return { results: await geocode(q, { lat: city.lat, lng: city.lng, countryCode: city.countryCode }) };
  } catch (err) {
    console.error("[geocode]", (err as Error).message);
    throw new ApiError(503, "La búsqueda de direcciones no está disponible ahora mismo. Marca el punto tocando el mapa.", "GEOCODE_UNAVAILABLE");
  }
});

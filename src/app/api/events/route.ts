import { z } from "zod";
import { route, parseJson, parseQuery, badRequest } from "@/server/http";
import { eventInputSchema } from "@/lib/validators";
import { createEvent, listEvents, viewerEventStates } from "@/server/services/events";
import { getCityBySlug, getCurrentCity } from "@/server/services/cities";
import { ISO_DATE_RE, dateNightWindow } from "@/lib/time";

const csv = z
  .string()
  .max(200)
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean).slice(0, 10) : undefined));

const querySchema = z.object({
  city: z.string().max(40).optional(),
  when: z.enum(["today", "tomorrow", "weekend", "week", "upcoming"]).optional(),
  date: z.string().regex(ISO_DATE_RE).optional(),
  venue: z.string().max(40).optional(),
  category: csv,
  genre: csv,
  maxPrice: z.coerce.number().int().min(0).max(100000).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.5).max(50).default(5),
  sort: z.enum(["soonest", "popular", "newest"]).default("soonest"),
  cursor: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(12),
});

export const GET = route({ rateLimit: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, querySchema);
  const city = q.city ? await getCityBySlug(q.city) : await getCurrentCity();
  if (!city) throw badRequest("Ciudad no válida");
  const page = await listEvents({
    cityId: city.id,
    timezone: city.timezone,
    when: q.date ? undefined : q.when,
    window: q.date ? dateNightWindow(q.date, city.timezone) : undefined,
    venueId: q.venue,
    categories: q.category,
    genres: q.genre,
    maxPrice: q.maxPrice,
    near: q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng, radiusKm: q.radius } : undefined,
    sort: q.sort,
    cursor: q.cursor,
    limit: q.limit,
  });
  const states = await viewerEventStates(user?.id, page.items.map((e) => e.id));
  return { ...page, viewer: Object.fromEntries(states) };
});

export const POST = route({ auth: true, rateLimit: "createEvent" }, async ({ req, user }) => {
  const input = await parseJson(req, eventInputSchema);
  return createEvent(user!, input);
});

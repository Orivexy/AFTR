import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { db } from "@/server/db";
import { getCurrentCity } from "@/server/services/cities";
import { normalizeSearch } from "@/lib/text";

/** Events you can tag in a post: from 4 days ago to the next week. */
export const GET = route({ auth: true, rateLimit: "read" }, async ({ req }) => {
  const { q } = parseQuery(req, z.object({ q: z.string().max(60).default("") }));
  const city = await getCurrentCity();
  const term = normalizeSearch(q);
  const now = Date.now();
  const items = await db.event.findMany({
    where: {
      cityId: city.id,
      status: "PUBLISHED",
      startsAt: { gte: new Date(now - 4 * 86400_000), lte: new Date(now + 7 * 86400_000) },
      ...(term ? { searchText: { contains: term } } : {}),
    },
    orderBy: { startsAt: "desc" },
    select: { id: true, title: true, startsAt: true, locationName: true, venueId: true, venue: { select: { name: true } } },
    take: 12,
  });
  return { items, timezone: city.timezone };
});

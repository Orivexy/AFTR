import "server-only";
import { db } from "../db";
import { eventCardSelect, toEventCard, toVenueCard, venueCardSelect } from "./mappers";
import { normalizeSearch } from "@/lib/text";
import type { EventCardData, VenueCardData } from "@/lib/types";

export interface SearchResults {
  query: string;
  events: EventCardData[];
  venues: VenueCardData[];
  users: Array<{ id: string; username: string; displayName: string; avatarKey: string | null; followerCount: number }>;
  places: Array<{ name: string; count: number; lat: number; lng: number }>;
}

/**
 * Global search over events, venues, users and neighbourhoods. Matching is
 * accent/case-insensitive on the maintained `searchText` columns; every term
 * must match. (Upgrade path: pg_trgm / full-text indexes on searchText.)
 */
export async function globalSearch(rawQuery: string, cityId: string, limit = 8): Promise<SearchResults> {
  const query = normalizeSearch(rawQuery).slice(0, 60);
  const terms = query.split(" ").filter((t) => t.length >= 2).slice(0, 5);
  if (!terms.length) return { query, events: [], venues: [], users: [], places: [] };

  const now = new Date();
  const [events, venues, users, neighborhoods] = await Promise.all([
    db.event.findMany({
      where: {
        cityId,
        status: "PUBLISHED",
        OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gt: new Date(now.getTime() - 6 * 3600_000) } }],
        AND: terms.map((t) => ({ searchText: { contains: t } })),
      },
      orderBy: { startsAt: "asc" },
      select: eventCardSelect,
      take: limit,
    }),
    db.venue.findMany({
      where: { cityId, isActive: true, AND: terms.map((t) => ({ searchText: { contains: t } })) },
      orderBy: { followerCount: "desc" },
      select: venueCardSelect,
      take: limit,
    }),
    db.profile.findMany({
      where: { user: { status: "ACTIVE" }, AND: terms.map((t) => ({ searchText: { contains: t } })) },
      orderBy: { followerCount: "desc" },
      select: { userId: true, username: true, displayName: true, avatarKey: true, followerCount: true },
      take: limit,
    }),
    db.venue.groupBy({
      by: ["neighborhood"],
      where: { cityId, isActive: true, neighborhood: { not: null } },
      _count: { _all: true },
      _avg: { lat: true, lng: true },
    }),
  ]);

  const places = neighborhoods
    .filter((n) => n.neighborhood && terms.every((t) => normalizeSearch(n.neighborhood!).includes(t)))
    .map((n) => ({ name: n.neighborhood!, count: n._count._all, lat: n._avg.lat ?? 0, lng: n._avg.lng ?? 0 }));

  return {
    query,
    events: events.map(toEventCard),
    venues: venues.map(toVenueCard),
    users: users.map(({ userId, ...u }) => ({ id: userId, ...u })),
    places,
  };
}

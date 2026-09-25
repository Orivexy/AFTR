import "server-only";
import type { Prisma } from "@prisma/client";
import type { EventCardData, UserMini, VenueCardData } from "@/lib/types";

/** Shared Prisma selects + mappers to client DTOs (see src/lib/types.ts). */

export const userMiniSelect = {
  id: true,
  profile: { select: { username: true, displayName: true, avatarKey: true } },
} satisfies Prisma.UserSelect;

export type UserMiniRow = Prisma.UserGetPayload<{ select: typeof userMiniSelect }>;

export function toUserMini(u: UserMiniRow): UserMini {
  return {
    id: u.id,
    username: u.profile?.username ?? "usuario",
    displayName: u.profile?.displayName ?? "Usuario",
    avatarKey: u.profile?.avatarKey ?? null,
  };
}

export const eventCardSelect = {
  id: true,
  slug: true,
  title: true,
  coverKey: true,
  startsAt: true,
  endsAt: true,
  priceMin: true,
  priceMax: true,
  locationName: true,
  address: true,
  lat: true,
  lng: true,
  interestedCount: true,
  goingCount: true,
  isFeatured: true,
  isDemo: true,
  status: true,
  category: { select: { slug: true, name: true, emoji: true } },
  genres: { select: { genre: { select: { slug: true, name: true } } }, orderBy: { genre: { order: "asc" } } },
  venue: { select: { id: true, slug: true, name: true, ratingAvg: true, ratingCount: true } },
  city: { select: { timezone: true, country: { select: { currency: true } } } },
} satisfies Prisma.EventSelect;

export type EventCardRow = Prisma.EventGetPayload<{ select: typeof eventCardSelect }>;

export function toEventCard(e: EventCardRow): EventCardData {
  const { genres, city, ...rest } = e;
  return {
    ...rest,
    genres: genres.map((g) => g.genre),
    timezone: city.timezone,
    currency: city.country.currency,
  };
}

export const venueCardSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  coverKey: true,
  neighborhood: true,
  address: true,
  lat: true,
  lng: true,
  ratingAvg: true,
  ratingCount: true,
  followerCount: true,
  priceMin: true,
  priceMax: true,
  isDemo: true,
  genres: { select: { genre: { select: { slug: true, name: true } } }, orderBy: { genre: { order: "asc" } } },
  city: { select: { country: { select: { currency: true } } } },
} satisfies Prisma.VenueSelect;

export type VenueCardRow = Prisma.VenueGetPayload<{ select: typeof venueCardSelect }>;

export function toVenueCard(v: VenueCardRow): VenueCardData {
  const { genres, city, ...rest } = v;
  return { ...rest, genres: genres.map((g) => g.genre), currency: city.country.currency };
}

export const photoSelect = {
  id: true,
  key: true,
  width: true,
  height: true,
  blurDataUrl: true,
} satisfies Prisma.PhotoSelect;

/** Offset cursors keep pagination uniform across sort orders. */
export function parseOffset(cursor: string | undefined): number {
  const n = Number(cursor);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 0;
}

export function nextOffset(offset: number, limit: number, received: number): string | null {
  return received > limit ? String(offset + limit) : null;
}

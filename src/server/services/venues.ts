import "server-only";
import type { Prisma, VenueType } from "@prisma/client";
import { db } from "../db";
import { badRequest, notFound } from "../http";
import type { SessionUser } from "../auth/session";
import { nextOffset, parseOffset, photoSelect, toUserMini, toVenueCard, userMiniSelect, venueCardSelect } from "./mappers";
import { boundingBox, distanceKm, type LatLng } from "@/lib/geo";
import type { GalleryPhoto, OpeningHours, Page, ReviewData, VenueCardData, VenueDetail } from "@/lib/types";
import type { z } from "zod";
import type { reviewSchema } from "@/lib/validators";
import { isStaff } from "@/lib/roles";
import { normalizeSearch } from "@/lib/text";
import { sanitizeHours } from "@/lib/hours";
import { SYSTEM_USERNAMES } from "@/config/system";

/** Photos imported from the venue's official website (uploaded by the discovery account). */
const OFFICIAL_UPLOADER: Prisma.PhotoWhereInput = { uploader: { profile: { username: SYSTEM_USERNAMES[0] } } };

export type VenueSort = "popular" | "rating" | "name";

export interface VenueQuery {
  cityId: string;
  genres?: string[];
  /** Venue kinds (CLUB, DISCO, CONCERT_HALL…). */
  types?: VenueType[];
  /** District (zone). */
  district?: string;
  sort?: VenueSort;
  near?: LatLng & { radiusKm: number };
  featured?: boolean;
  /** Free text over name, address, neighbourhood (accent-insensitive). */
  q?: string;
  cursor?: string;
  limit?: number;
}

export async function listVenues(q: VenueQuery): Promise<Page<VenueCardData>> {
  const limit = q.limit ?? 12;
  const offset = parseOffset(q.cursor);
  const where: Prisma.VenueWhereInput = { cityId: q.cityId, isActive: true };
  if (q.genres?.length) where.genres = { some: { genre: { slug: { in: q.genres } } } };
  if (q.featured) where.isFeatured = true;
  if (q.types?.length) where.type = { in: q.types };
  if (q.district) where.district = q.district;
  const terms = normalizeSearch(q.q ?? "").split(" ").filter((t) => t.length >= 2).slice(0, 5);
  if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));
  if (q.near) {
    const bb = boundingBox(q.near, q.near.radiusKm);
    where.lat = { gte: bb.minLat, lte: bb.maxLat };
    where.lng = { gte: bb.minLng, lte: bb.maxLng };
  }
  // Main places (isFeatured) always come first.
  const orderBy: Prisma.VenueOrderByWithRelationInput[] = [
    { isFeatured: "desc" },
    ...(q.sort === "rating"
      ? [{ ratingAvg: "desc" as const }, { ratingCount: "desc" as const }]
      : q.sort === "name"
        ? [{ name: "asc" as const }]
        : [{ followerCount: "desc" as const }, { ratingCount: "desc" as const }, { name: "asc" as const }]),
  ];

  const rows = await db.venue.findMany({ where, orderBy, select: venueCardSelect, skip: offset, take: limit + 1 });
  let items = rows.slice(0, limit).map(toVenueCard);
  if (q.near) {
    const near = q.near;
    items = items.filter((v) => distanceKm(near, v) <= near.radiusKm).sort((a, b) => distanceKm(near, a) - distanceKm(near, b));
  }
  return { items, nextCursor: nextOffset(offset, limit, rows.length) };
}

const reviewSelect = {
  id: true,
  rating: true,
  ambience: true,
  music: true,
  staff: true,
  price: true,
  space: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userMiniSelect },
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;
const toReview = ({ user, ...r }: ReviewRow): ReviewData => ({ ...r, user: toUserMini(user) });

export async function getVenueDetail(slug: string, viewer: SessionUser | null): Promise<VenueDetail | null> {
  const v = await db.venue.findUnique({
    where: { slug },
    select: {
      ...venueCardSelect,
      description: true,
      openingHours: true,
      minAge: true,
      website: true,
      instagram: true,
      phone: true,
      trust: true,
      sourceUrl: true,
      lastVerifiedAt: true,
      hoursUpdatedAt: true,
      primarySource: { select: { name: true, type: true } },
      isActive: true,
      city: { select: { slug: true, name: true, timezone: true, country: { select: { currency: true } } } },
    },
  });
  if (!v || (!v.isActive && !isStaff(viewer?.role))) return null;

  const [agg, dist, following, myReview, manager, officialPhotos] = await Promise.all([
    db.review.aggregate({
      where: { venueId: v.id, isHidden: false },
      _avg: { ambience: true, music: true, staff: true, price: true, space: true },
    }),
    db.review.groupBy({ by: ["rating"], where: { venueId: v.id, isHidden: false }, _count: { _all: true } }),
    viewer ? db.venueFollow.findUnique({ where: { userId_venueId: { userId: viewer.id, venueId: v.id } } }) : null,
    viewer ? db.review.findUnique({ where: { userId_venueId: { userId: viewer.id, venueId: v.id } }, select: reviewSelect }) : null,
    viewer ? db.venue.count({ where: { id: v.id, managers: { some: { id: viewer.id } } } }) : 0,
    db.photo.findMany({ where: { venueId: v.id, status: "VISIBLE", postId: null, ...OFFICIAL_UPLOADER }, orderBy: { position: "asc" }, select: { ...photoSelect, zone: true }, take: 12 }),
  ]);

  const distribution = [0, 0, 0, 0, 0];
  for (const d of dist) distribution[d.rating - 1] = d._count._all;
  const round = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

  return {
    ...toVenueCard(v),
    description: v.description,
    timezone: v.city.timezone,
    openingHours: sanitizeHours(v.openingHours as OpeningHours | null),
    phone: v.phone,
    provenance: {
      trust: v.trust,
      sourceName: v.primarySource?.type === "OSM_OVERPASS" ? "OpenStreetMap" : (v.primarySource?.name ?? null),
      sourceUrl: v.sourceUrl,
      attribution: v.primarySource?.type === "OSM_OVERPASS" ? "© OpenStreetMap contributors" : null,
      lastVerifiedAt: v.lastVerifiedAt,
      hoursUpdatedAt: v.hoursUpdatedAt,
    },
    minAge: v.minAge,
    website: v.website,
    instagram: v.instagram,
    officialPhotos,
    city: { slug: v.city.slug, name: v.city.name },
    subScores: {
      ambience: round(agg._avg.ambience),
      music: round(agg._avg.music),
      staff: round(agg._avg.staff),
      price: round(agg._avg.price),
      space: round(agg._avg.space),
    },
    ratingDistribution: distribution,
    viewer: {
      following: Boolean(following),
      review: myReview ? toReview(myReview) : null,
      canManage: Boolean(manager) || isStaff(viewer?.role),
    },
  };
}

export async function listReviews(venueId: string, cursor?: string, limit = 10): Promise<Page<ReviewData>> {
  const offset = parseOffset(cursor);
  const rows = await db.review.findMany({
    where: { venueId, isHidden: false },
    orderBy: [{ comment: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    select: reviewSelect,
    skip: offset,
    take: limit + 1,
  });
  return { items: rows.slice(0, limit).map(toReview), nextCursor: nextOffset(offset, limit, rows.length) };
}

/** Recomputes the denormalised rating from the source of truth. */
async function refreshVenueRating(tx: Prisma.TransactionClient, venueId: string) {
  const agg = await tx.review.aggregate({ where: { venueId, isHidden: false }, _avg: { rating: true }, _count: { _all: true } });
  await tx.venue.update({
    where: { id: venueId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100, ratingCount: agg._count._all },
  });
}

/** One review per user and venue: creating again edits the existing one. */
export async function upsertReview(userId: string, venueId: string, input: z.infer<typeof reviewSchema>) {
  const venue = await db.venue.findFirst({ where: { id: venueId, isActive: true }, select: { id: true } });
  if (!venue) throw notFound("Local no encontrado");
  const data = {
    rating: input.rating,
    ambience: input.ambience ?? null,
    music: input.music ?? null,
    staff: input.staff ?? null,
    price: input.price ?? null,
    space: input.space ?? null,
    comment: input.comment ?? null,
  };
  return db.$transaction(async (tx) => {
    const review = await tx.review.upsert({
      where: { userId_venueId: { userId, venueId } },
      create: { userId, venueId, ...data },
      update: data,
      select: reviewSelect,
    });
    await refreshVenueRating(tx, venueId);
    return toReview(review);
  });
}

export async function deleteReview(userId: string, venueId: string) {
  await db.$transaction(async (tx) => {
    await tx.review.deleteMany({ where: { userId, venueId } });
    await refreshVenueRating(tx, venueId);
  });
}

export async function setReviewHidden(reviewId: string, hidden: boolean) {
  await db.$transaction(async (tx) => {
    const r = await tx.review.update({ where: { id: reviewId }, data: { isHidden: hidden }, select: { venueId: true } });
    await refreshVenueRating(tx, r.venueId);
  });
}

export async function setVenueFollow(userId: string, venueId: string, follow: boolean) {
  return db.$transaction(async (tx) => {
    const existing = await tx.venueFollow.findUnique({ where: { userId_venueId: { userId, venueId } } });
    if (follow && !existing) {
      await tx.venueFollow.create({ data: { userId, venueId } });
      await tx.venue.update({ where: { id: venueId }, data: { followerCount: { increment: 1 } } });
    } else if (!follow && existing) {
      await tx.venueFollow.delete({ where: { userId_venueId: { userId, venueId } } });
      await tx.venue.update({ where: { id: venueId }, data: { followerCount: { decrement: 1 } } });
    }
    const v = await tx.venue.findUniqueOrThrow({ where: { id: venueId }, select: { followerCount: true } });
    return { following: follow, followerCount: v.followerCount };
  });
}

export async function venueGallery(venueId: string, viewerId: string | undefined, cursor?: string, limit = 18): Promise<Page<GalleryPhoto>> {
  const offset = parseOffset(cursor);
  const rows = await db.photo.findMany({
    where: { venueId, status: "VISIBLE", postId: null, NOT: OFFICIAL_UPLOADER },
    orderBy: { createdAt: "desc" },
    select: { ...photoSelect, createdAt: true, likeCount: true, uploader: { select: userMiniSelect } },
    skip: offset,
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const liked = viewerId
    ? new Set(
        (await db.like.findMany({ where: { userId: viewerId, photoId: { in: page.map((p) => p.id) } }, select: { photoId: true } })).map(
          (l) => l.photoId,
        ),
      )
    : new Set<string | null>();
  return {
    items: page.map(({ uploader, ...p }) => ({ ...p, uploader: toUserMini(uploader), liked: liked.has(p.id) })),
    nextCursor: nextOffset(offset, limit, rows.length),
  };
}

/** Attaches the user's pending uploads to a venue's community gallery. */
export async function addVenuePhotos(userId: string, venueId: string, photoIds: string[]) {
  const venue = await db.venue.findFirst({ where: { id: venueId, isActive: true }, select: { id: true } });
  if (!venue) throw notFound("Local no encontrado");
  const { count } = await db.photo.updateMany({
    where: { id: { in: photoIds }, uploaderId: userId, venueId: null, postId: null, eventId: null },
    data: { venueId },
  });
  if (count !== photoIds.length) throw badRequest("Alguna foto no es válida");
  return { added: count };
}

export async function togglePhotoLike(userId: string, photoId: string, like: boolean) {
  return db.$transaction(async (tx) => {
    const photo = await tx.photo.findFirst({ where: { id: photoId, status: "VISIBLE" }, select: { id: true } });
    if (!photo) throw notFound("Foto no encontrada");
    const existing = await tx.like.findUnique({ where: { userId_photoId: { userId, photoId } } });
    if (like && !existing) {
      await tx.like.create({ data: { userId, photoId } });
      await tx.photo.update({ where: { id: photoId }, data: { likeCount: { increment: 1 } } });
    } else if (!like && existing) {
      await tx.like.delete({ where: { id: existing.id } });
      await tx.photo.update({ where: { id: photoId }, data: { likeCount: { decrement: 1 } } });
    }
    const p = await tx.photo.findUniqueOrThrow({ where: { id: photoId }, select: { likeCount: true } });
    return { liked: like, likeCount: p.likeCount };
  });
}

export async function venueOptions(cityId: string) {
  return db.venue.findMany({
    where: { cityId, isActive: true },
    select: { id: true, name: true, address: true, lat: true, lng: true, neighborhood: true },
    orderBy: { name: "asc" },
  });
}

/** Zones (districts) that have listed places, for the zone filter. */
export async function listZones(cityId: string): Promise<string[]> {
  const rows = await db.venue.groupBy({ by: ["district"], where: { cityId, isActive: true, district: { not: null } }, _count: { _all: true } });
  return rows.map((r) => r.district!).sort((a, b) => a.localeCompare(b, "es"));
}

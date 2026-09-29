import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import type { SessionUser } from "../auth/session";
import { getCityBySlug } from "./cities";
import { buildSearchText, slugify } from "@/lib/text";
import { isStaff } from "@/lib/roles";
import type { venueCreateSchema, venueManageSchema } from "@/lib/validators";

/**
 * Venue profile management by its managers (verified venue accounts) and
 * staff. Every change is recorded in VenueChange; manager edits make the
 * venue OFFICIAL, so data sources only fill gaps afterwards.
 */
export async function canManageVenue(user: Pick<SessionUser, "id" | "role"> | null, venueId: string): Promise<boolean> {
  if (!user) return false;
  if (isStaff(user.role)) return true;
  return (await db.venue.count({ where: { id: venueId, managers: { some: { id: user.id } } } })) > 0;
}

const str = (v: unknown) => (v == null ? null : typeof v === "string" ? v : JSON.stringify(v));

export async function updateVenueProfile(user: SessionUser, venueId: string, input: z.infer<typeof venueManageSchema>) {
  if (!(await canManageVenue(user, venueId))) throw forbidden();
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: {
      name: true, description: true, address: true, neighborhood: true, lat: true, lng: true, phone: true, website: true, instagram: true,
      priceMin: true, priceMax: true, minAge: true, openingHours: true, coverKey: true, fieldUpdatedAt: true, trust: true,
      city: { select: { name: true } }, genres: { select: { genre: { select: { slug: true } } } },
    },
  });
  if (!venue) throw notFound("Local no encontrado");
  if (input.priceMin != null && input.priceMax != null && input.priceMax < input.priceMin) throw badRequest("El precio máximo no puede ser menor que el mínimo", { priceMax: "Menor que el mínimo" });

  const { genres, coverPhotoId, openingHours, ...fields } = input;
  const data: Prisma.VenueUpdateInput = {};
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const current = (venue as Record<string, unknown>)[field];
    if (str(current) === str(value)) continue;
    (data as Record<string, unknown>)[field] = value;
    changes.push({ field, oldValue: str(current), newValue: str(value) });
  }
  const now = new Date();
  if (openingHours !== undefined && str(openingHours) !== str(venue.openingHours)) {
    const clean = openingHours && Object.values(openingHours).some((d) => d?.length) ? openingHours : null;
    data.openingHours = clean ?? Prisma.DbNull;
    Object.assign(data, { hoursSource: isStaff(user.role) ? "staff" : "official", hoursUpdatedAt: now });
    changes.push({ field: "openingHours", oldValue: str(venue.openingHours), newValue: str(clean) });
  }
  if (coverPhotoId !== undefined) {
    let coverKey: string | null = null;
    if (coverPhotoId) {
      const photo = await db.photo.findFirst({ where: { id: coverPhotoId, uploaderId: user.id, postId: null, eventId: null }, select: { key: true } });
      if (!photo) throw badRequest("Foto no válida");
      coverKey = photo.key;
    }
    if (coverKey !== venue.coverKey) {
      data.coverKey = coverKey;
      changes.push({ field: "coverKey", oldValue: venue.coverKey, newValue: coverKey });
    }
  }
  const currentGenres = venue.genres.map((g) => g.genre.slug).sort().join(",");
  const genreRows = genres ? await db.musicGenre.findMany({ where: { slug: { in: genres } }, select: { id: true, slug: true } }) : null;
  const genresChanged = genreRows && genreRows.map((g) => g.slug).sort().join(",") !== currentGenres;
  if (genresChanged) changes.push({ field: "genres", oldValue: currentGenres || null, newValue: genreRows.map((g) => g.slug).join(",") || null });
  if (!changes.length) return { changed: false };

  if (data.name || data.address || data.neighborhood !== undefined) {
    data.searchText = buildSearchText(
      (data.name as string) ?? venue.name,
      (data.address as string) ?? venue.address,
      data.neighborhood === undefined ? venue.neighborhood : (data.neighborhood as string | null),
      venue.city.name,
    );
  }
  const fieldUpdatedAt = { ...((venue.fieldUpdatedAt as Record<string, string> | null) ?? {}) };
  for (const c of changes) fieldUpdatedAt[c.field] = now.toISOString();
  // A manager's own data is official; sources stop overwriting it.
  const official = !isStaff(user.role) ? { trust: "OFFICIAL" as const, primarySource: { disconnect: true } } : {};

  await db.$transaction(async (tx) => {
    if (genresChanged) {
      await tx.venueGenre.deleteMany({ where: { venueId } });
      await tx.venueGenre.createMany({ data: genreRows.map((g) => ({ venueId, genreId: g.id })) });
    }
    await tx.venue.update({ where: { id: venueId }, data: { ...data, ...official, fieldUpdatedAt, lastVerifiedAt: now } });
    await tx.venueChange.createMany({ data: changes.map((c) => ({ ...c, venueId })) });
  });
  return { changed: true };
}

/** Staff creates a venue by hand (e.g. one no data source knows yet). */
export async function createVenueManually(input: z.infer<typeof venueCreateSchema>) {
  const city = await getCityBySlug(input.citySlug);
  if (!city) throw badRequest("Ciudad no válida", { citySlug: "Ciudad no válida" });
  const now = new Date();
  return db.venue.create({
    data: {
      slug: `${slugify(input.name) || "local"}-${randomBytes(2).toString("hex")}`,
      name: input.name,
      type: input.type,
      cityId: city.id,
      address: input.address,
      neighborhood: input.neighborhood ?? null,
      lat: input.lat,
      lng: input.lng,
      website: input.website ?? null,
      trust: "VERIFIED",
      lastVerifiedAt: now,
      searchText: buildSearchText(input.name, input.address, input.neighborhood, city.name),
    },
    select: { id: true, slug: true },
  });
}

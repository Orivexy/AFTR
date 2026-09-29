import "server-only";
import type { BusinessType } from "@prisma/client";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { notify } from "./notifications";
import { isStaff } from "@/lib/roles";

/**
 * Self-service organizer / venue accounts.
 *
 * A user asks (type, trade name, contact, and for venues the venue they
 * manage). Staff approve or reject in /admin/businesses. Approval — never
 * the request itself — grants the ORGANIZER/VENUE role, links the venue
 * and makes its managers' data official (sources stop overwriting it).
 */
export async function requestBusiness(
  userId: string,
  input: { type: BusinessType; tradeName: string; contactEmail?: string | null; contactPhone?: string | null; website?: string | null; venueId?: string | null; message?: string | null },
) {
  const pending = await db.businessProfile.findFirst({ where: { ownerId: userId, verification: "PENDING" }, select: { id: true } });
  if (pending) throw badRequest("Ya tienes una solicitud pendiente de revisión");
  let requestedVenueId: string | null = null;
  if (input.type === "VENUE") {
    if (!input.venueId) throw badRequest("Elige el local que gestionas", { venueId: "Elige un local" });
    const venue = await db.venue.findFirst({ where: { id: input.venueId, isActive: true }, select: { id: true, business: { select: { verification: true } } } });
    if (!venue) throw notFound("Local no encontrado");
    if (venue.business?.verification === "VERIFIED") throw badRequest("Ese local ya tiene una cuenta oficial. Si es un error, contacta con nosotros.");
    requestedVenueId = venue.id;
  }
  return db.businessProfile.create({
    data: {
      ownerId: userId,
      type: input.type,
      tradeName: input.tradeName,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      website: input.website || null,
      requestedVenueId,
      requestMessage: input.message || null,
      verification: "PENDING",
    },
    select: { id: true },
  });
}

export async function withdrawRequest(userId: string, id: string) {
  const { count } = await db.businessProfile.deleteMany({ where: { id, ownerId: userId, verification: "PENDING" } });
  if (!count) throw notFound("Solicitud no encontrada");
}

/** Approves a request or a staff-created business: role, venue link, official data. */
export async function approveBusiness(id: string, reviewerId: string, note?: string | null) {
  const b = await db.businessProfile.findUnique({
    where: { id },
    select: { id: true, ownerId: true, type: true, venueId: true, requestedVenueId: true, owner: { select: { role: true } } },
  });
  if (!b) throw notFound("Negocio no encontrado");
  const venueId = b.venueId ?? b.requestedVenueId;
  if (b.type === "VENUE" && !venueId) throw badRequest("Un negocio de tipo local necesita un local");
  if (venueId) {
    const taken = await db.businessProfile.findFirst({ where: { venueId, id: { not: id } }, select: { id: true } });
    if (taken) throw badRequest("Ese local ya está vinculado a otro negocio");
  }
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.businessProfile.update({
      where: { id },
      data: { verification: "VERIFIED", verifiedAt: now, reviewedAt: now, reviewedById: reviewerId, reviewNote: note ?? null, venueId, requestedVenueId: null },
    });
    if (!isStaff(b.owner.role)) await tx.user.update({ where: { id: b.ownerId }, data: { role: b.type === "VENUE" ? "VENUE" : "ORGANIZER" } });
    if (venueId) {
      // The venue now speaks for itself: data sources only fill gaps from here on.
      await tx.venue.update({ where: { id: venueId }, data: { managers: { connect: { id: b.ownerId } }, trust: "OFFICIAL", primarySourceId: null } });
    }
  });
  await notify({ userId: b.ownerId, type: "BUSINESS_APPROVED", dedupeKey: `business-approved:${id}:${now.getTime()}` });
}

export async function rejectBusiness(id: string, reviewerId: string, note?: string | null) {
  const b = await db.businessProfile.findUnique({ where: { id }, select: { ownerId: true, venueId: true, owner: { select: { role: true } } } });
  if (!b) throw notFound("Negocio no encontrado");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.businessProfile.update({ where: { id }, data: { verification: "REJECTED", reviewedAt: now, reviewedById: reviewerId, reviewNote: note ?? null } });
    // Losing verification removes the commercial role unless another business is still verified.
    const others = await tx.businessProfile.count({ where: { ownerId: b.ownerId, verification: "VERIFIED", id: { not: id } } });
    if (!others && !isStaff(b.owner.role)) await tx.user.update({ where: { id: b.ownerId }, data: { role: "USER" } });
    if (b.venueId) await tx.venue.update({ where: { id: b.venueId }, data: { managers: { disconnect: { id: b.ownerId } } } });
  });
  await notify({ userId: b.ownerId, type: "BUSINESS_REJECTED", dedupeKey: `business-rejected:${id}:${now.getTime()}` });
}

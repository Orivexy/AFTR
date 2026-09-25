import "server-only";
import type { BusinessType, BusinessVerification, CommercialStatus, PlanCode } from "@prisma/client";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { isStaff } from "@/lib/roles";
import { assertFeature } from "./flags";

/**
 * Commercial accounts (organizers and venues). Staff creates them; owners
 * can only edit their own contact data. Verification, commercial status and
 * plan are staff-only fields and are never accepted from owners.
 */
export async function createBusiness(input: {
  username: string;
  type: BusinessType;
  tradeName: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  venueSlug?: string;
}) {
  const profile = await db.profile.findUnique({ where: { username: input.username }, select: { userId: true, user: { select: { role: true } } } });
  if (!profile) throw notFound("Usuario no encontrado");
  const venue = input.venueSlug ? await db.venue.findUnique({ where: { slug: input.venueSlug }, select: { id: true, business: { select: { id: true } } } }) : null;
  if (input.venueSlug && !venue) throw notFound("Local no encontrado");
  if (venue?.business) throw badRequest("Ese local ya tiene un negocio asociado");
  if (input.type === "VENUE" && !venue) throw badRequest("Un negocio de tipo local necesita un local asociado");

  return db.$transaction(async (tx) => {
    const business = await tx.businessProfile.create({
      data: {
        ownerId: profile.userId,
        type: input.type,
        tradeName: input.tradeName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        website: input.website,
        venueId: venue?.id,
      },
    });
    // Commercial role for regular users; staff keep their role.
    if (!isStaff(profile.user.role)) {
      await tx.user.update({ where: { id: profile.userId }, data: { role: input.type === "VENUE" ? "VENUE" : "ORGANIZER" } });
    }
    if (venue) await tx.venue.update({ where: { id: venue.id }, data: { managers: { connect: { id: profile.userId } } } });
    return business;
  });
}

export async function updateBusinessAdmin(id: string, input: { verification?: BusinessVerification; commercialStatus?: CommercialStatus; plan?: PlanCode; tradeName?: string }) {
  if (input.plan && input.plan !== "PLAN_FREE") assertFeature("premium");
  return db.businessProfile.update({
    where: { id },
    data: {
      ...input,
      ...(input.verification ? { verifiedAt: input.verification === "VERIFIED" ? new Date() : null } : {}),
    },
    select: { id: true },
  });
}

/** Owner-side update: contact data only, scoped to businesses the user owns. */
export async function updateOwnBusiness(userId: string, id: string, input: { contactEmail?: string | null; contactPhone?: string | null; website?: string | null }) {
  const { count } = await db.businessProfile.updateMany({ where: { id, ownerId: userId }, data: input });
  if (!count) throw notFound("Negocio no encontrado");
}

export function listOwnBusinesses(userId: string) {
  return db.businessProfile.findMany({
    where: { ownerId: userId },
    select: {
      id: true, type: true, tradeName: true, contactEmail: true, contactPhone: true, website: true,
      verification: true, commercialStatus: true, plan: true,
      venue: { select: { slug: true, name: true } },
      _count: { select: { events: true } },
    },
  });
}

/** The business an event created by this user should belong to (never client-provided). */
export async function businessForOrganizer(userId: string, venueId: string | null): Promise<string | null> {
  const businesses = await db.businessProfile.findMany({ where: { ownerId: userId }, select: { id: true, venueId: true } });
  return (venueId ? businesses.find((b) => b.venueId === venueId)?.id : undefined) ?? businesses.find((b) => !b.venueId)?.id ?? null;
}

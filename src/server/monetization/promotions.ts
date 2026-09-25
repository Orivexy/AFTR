import "server-only";
import type { PromotionType, SponsorType } from "@prisma/client";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { assertFeature } from "./flags";

const SPONSOR_FOR: Record<PromotionType, SponsorType> = {
  FEATURED_EVENT: "FEATURED",
  FEATURED_VENUE: "FEATURED",
  SPONSORED_POST: "SPONSORED",
  AD: "AD",
};

/**
 * Activates a paid promotion: marks the target content with its sponsor type
 * so the UI labels it. Blocked while sponsored content / ads are disabled.
 */
export async function activatePromotion(promotionId: string) {
  const p = await db.promotion.findUnique({ where: { id: promotionId } });
  if (!p) throw notFound("Promoción no encontrada");
  assertFeature(p.type === "AD" ? "ads" : "sponsored");
  if (p.endsAt && p.endsAt < new Date()) throw badRequest("La promoción ya ha terminado");
  const marker = SPONSOR_FOR[p.type];
  await db.$transaction([
    db.promotion.update({ where: { id: p.id }, data: { status: "ACTIVE" } }),
    ...(p.eventId ? [db.event.update({ where: { id: p.eventId }, data: { promotionType: marker } })] : []),
    ...(p.venueId ? [db.venue.update({ where: { id: p.venueId }, data: { promotionType: marker } })] : []),
    ...(p.postId ? [db.post.update({ where: { id: p.postId }, data: { promotionType: marker } })] : []),
  ]);
}

/** Ends expired promotions and clears their markers (safe to run anytime). */
export async function endExpiredPromotions(now = new Date()) {
  const expired = await db.promotion.findMany({ where: { status: "ACTIVE", endsAt: { lte: now } } });
  for (const p of expired) {
    await db.$transaction([
      db.promotion.update({ where: { id: p.id }, data: { status: "ENDED" } }),
      ...(p.eventId ? [db.event.update({ where: { id: p.eventId }, data: { promotionType: "NONE" } })] : []),
      ...(p.venueId ? [db.venue.update({ where: { id: p.venueId }, data: { promotionType: "NONE" } })] : []),
      ...(p.postId ? [db.post.update({ where: { id: p.postId }, data: { promotionType: "NONE" } })] : []),
    ]);
  }
  return { ended: expired.length };
}

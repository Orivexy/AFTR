import { route, parseJson, notFound } from "@/server/http";
import { promotionCreateSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

/** Creates a DRAFT promotion (no visible effect until activated). */
export const POST = route({ auth: "admin" }, async ({ req, user, ip }) => {
  const { target, ...input } = await parseJson(req, promotionCreateSchema);
  const link =
    input.type === "FEATURED_VENUE"
      ? { venueId: (await db.venue.findUnique({ where: { slug: target }, select: { id: true } }))?.id }
      : input.type === "SPONSORED_POST"
        ? { postId: (await db.post.findUnique({ where: { id: target }, select: { id: true } }))?.id }
        : { eventId: (await db.event.findUnique({ where: { slug: target }, select: { id: true } }))?.id };
  if (!Object.values(link)[0]) throw notFound("Contenido no encontrado");
  const promotion = await db.promotion.create({ data: { ...input, ...link, status: "DRAFT" }, select: { id: true } });
  await audit({ actorId: user!.id, action: "promotion.create", targetType: "PROMOTION", targetId: promotion.id, metadata: { type: input.type, target }, ip });
  return { promotion };
});

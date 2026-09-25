import { route, parseJson } from "@/server/http";
import { reviewSchema } from "@/lib/validators";
import { deleteReview, upsertReview } from "@/server/services/venues";
import { db } from "@/server/db";

/** Create or edit the viewer's single review of this venue. */
export const PUT = route<{ id: string }>({ auth: true, rateLimit: "comment" }, async ({ req, params, user }) => {
  const input = await parseJson(req, reviewSchema);
  const review = await upsertReview(user!.id, params.id, input);
  const venue = await db.venue.findUniqueOrThrow({ where: { id: params.id }, select: { ratingAvg: true, ratingCount: true } });
  return { review, venue };
});

export const DELETE = route<{ id: string }>({ auth: true }, async ({ params, user }) => {
  await deleteReview(user!.id, params.id);
  return { ok: true };
});

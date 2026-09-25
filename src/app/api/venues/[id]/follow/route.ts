import { z } from "zod";
import { route, parseJson, notFound } from "@/server/http";
import { db } from "@/server/db";
import { setVenueFollow } from "@/server/services/venues";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { following } = await parseJson(req, z.object({ following: z.boolean() }));
  const venue = await db.venue.findFirst({ where: { id: params.id, isActive: true }, select: { id: true } });
  if (!venue) throw notFound("Local no encontrado");
  return setVenueFollow(user!.id, venue.id, following);
});

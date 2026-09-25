import { z } from "zod";
import { route, parseJson, parseQuery } from "@/server/http";
import { venuePhotoSchema } from "@/lib/validators";
import { addVenuePhotos, venueGallery } from "@/server/services/venues";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params, user }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(20).optional() }));
  return venueGallery(params.id, user?.id, cursor);
});

export const POST = route<{ id: string }>({ auth: true, rateLimit: "createPost" }, async ({ req, params, user }) => {
  const { photoIds } = await parseJson(req, venuePhotoSchema);
  return addVenuePhotos(user!.id, params.id, photoIds);
});

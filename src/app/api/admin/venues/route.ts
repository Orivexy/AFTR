import { route, parseJson } from "@/server/http";
import { venueCreateSchema } from "@/lib/validators";
import { createVenueManually } from "@/server/services/venue-manage";

export const POST = route({ auth: "moderator", audit: { action: "venue.create", targetType: "VENUE" } }, async ({ req }) => {
  return createVenueManually(await parseJson(req, venueCreateSchema));
});

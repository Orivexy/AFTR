import { route, parseJson } from "@/server/http";
import { venueManageSchema } from "@/lib/validators";
import { updateVenueProfile } from "@/server/services/venue-manage";

/** Managers of the venue (verified venue accounts) and staff edit its profile. */
export const PATCH = route<{ id: string }>({ auth: true, rateLimit: "interaction", audit: { action: "venue.manage", targetType: "VENUE" } }, async ({ req, params, user }) => {
  return updateVenueProfile(user!, params.id, await parseJson(req, venueManageSchema));
});

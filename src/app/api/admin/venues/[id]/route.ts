import { route, parseJson } from "@/server/http";
import { venueAdminUpdateSchema } from "@/lib/validators";
import { updateVenue } from "@/server/services/admin";

export const PATCH = route<{ id: string }>({ auth: "moderator" }, async ({ req, params }) => {
  const input = await parseJson(req, venueAdminUpdateSchema);
  return { venue: await updateVenue(params.id, input) };
});

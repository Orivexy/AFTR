import { route, parseJson, badRequest } from "@/server/http";
import { venueRecordActionSchema } from "@/lib/validators";
import { approveVenueRecord, mergeVenueRecord, setVenueRecordStatus } from "@/server/discovery/review";

export const POST = route<{ id: string }>({ auth: "moderator", audit: { action: "discovery.venue.review", targetType: "SOURCE_VENUE_RECORD" } }, async ({ req, params }) => {
  const { action, venueId, ...edits } = await parseJson(req, venueRecordActionSchema);
  if (action === "approve") {
    try {
      return { venue: await approveVenueRecord(params.id, edits) };
    } catch (err) {
      throw badRequest((err as Error).message);
    }
  }
  if (action === "merge") {
    if (!venueId) throw badRequest("Indica el local");
    await mergeVenueRecord(params.id, venueId);
    return { ok: true };
  }
  await setVenueRecordStatus(params.id, action);
  return { ok: true };
});

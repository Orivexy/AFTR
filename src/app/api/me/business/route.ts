import { route, parseJson } from "@/server/http";
import { businessRequestSchema } from "@/lib/validators";
import { listOwnBusinesses } from "@/server/monetization/business";
import { requestBusiness } from "@/server/services/business-requests";

export const GET = route({ auth: true, rateLimit: "read" }, async ({ user }) => ({ items: await listOwnBusinesses(user!.id) }));

/** Asks staff for an organizer / venue account (reviewed in /admin/businesses). */
export const POST = route({ auth: true, rateLimit: "report", audit: { action: "business.request", targetType: "BUSINESS" } }, async ({ req, user }) => {
  const input = await parseJson(req, businessRequestSchema);
  return { business: await requestBusiness(user!.id, input) };
});

import { route, parseJson } from "@/server/http";
import { businessAdminUpdateSchema } from "@/lib/validators";
import { updateBusinessAdmin } from "@/server/monetization/business";

export const PATCH = route<{ id: string }>({ auth: "admin", audit: { action: "business.update", targetType: "BUSINESS" } }, async ({ req, params }) => {
  const input = await parseJson(req, businessAdminUpdateSchema);
  return { business: await updateBusinessAdmin(params.id, input) };
});

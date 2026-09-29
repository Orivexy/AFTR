import { route, parseJson } from "@/server/http";
import { businessAdminUpdateSchema } from "@/lib/validators";
import { updateBusinessAdmin } from "@/server/monetization/business";
import { approveBusiness, rejectBusiness } from "@/server/services/business-requests";

export const PATCH = route<{ id: string }>({ auth: "admin", audit: { action: "business.update", targetType: "BUSINESS" } }, async ({ req, params, user }) => {
  const { verification, reviewNote, ...rest } = await parseJson(req, businessAdminUpdateSchema);
  // Approving / rejecting has side effects (role, venue managers, notification).
  if (verification === "VERIFIED") await approveBusiness(params.id, user!.id, reviewNote);
  else if (verification === "REJECTED") await rejectBusiness(params.id, user!.id, reviewNote);
  else if (verification) await updateBusinessAdmin(params.id, { verification });
  if (Object.keys(rest).length) await updateBusinessAdmin(params.id, rest);
  return { ok: true };
});

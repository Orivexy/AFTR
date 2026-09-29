import { route, parseJson } from "@/server/http";
import { businessOwnerUpdateSchema } from "@/lib/validators";
import { updateOwnBusiness } from "@/server/monetization/business";
import { withdrawRequest } from "@/server/services/business-requests";

/** Owners edit contact data of their own business (ownership enforced in the query). */
export const PATCH = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const input = await parseJson(req, businessOwnerUpdateSchema);
  await updateOwnBusiness(user!.id, params.id, input);
  return { ok: true };
});

/** Withdraws a pending request. */
export const DELETE = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ params, user }) => {
  await withdrawRequest(user!.id, params.id);
  return { ok: true };
});

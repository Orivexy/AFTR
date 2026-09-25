import { route, parseJson } from "@/server/http";
import { businessOwnerUpdateSchema } from "@/lib/validators";
import { updateOwnBusiness } from "@/server/monetization/business";

/** Owners edit contact data of their own business (ownership enforced in the query). */
export const PATCH = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const input = await parseJson(req, businessOwnerUpdateSchema);
  await updateOwnBusiness(user!.id, params.id, input);
  return { ok: true };
});

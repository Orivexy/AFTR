import { route, parseJson } from "@/server/http";
import { businessCreateSchema } from "@/lib/validators";
import { createBusiness } from "@/server/monetization/business";
import { audit } from "@/server/audit";

export const POST = route({ auth: "admin" }, async ({ req, user, ip }) => {
  const input = await parseJson(req, businessCreateSchema);
  const business = await createBusiness(user!.id, input);
  await audit({ actorId: user!.id, action: "business.create", targetType: "BUSINESS", targetId: business.id, metadata: input, ip });
  return { business: { id: business.id } };
});

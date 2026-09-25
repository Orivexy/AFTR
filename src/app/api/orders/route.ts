import { route, parseJson } from "@/server/http";
import { orderCreateSchema } from "@/lib/validators";
import { createOrder } from "@/server/monetization/orders";

/** Native ticket checkout. Returns 403 FEATURE_DISABLED while TICKETS_ENABLED is off. */
export const POST = route({ auth: true, rateLimit: "createPost" }, async ({ req, user }) => {
  const input = await parseJson(req, orderCreateSchema);
  return { order: await createOrder(user!, input) };
});

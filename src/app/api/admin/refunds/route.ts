import { route, parseJson } from "@/server/http";
import { refundRequestSchema } from "@/lib/validators";
import { requestRefund } from "@/server/monetization/refunds";
import { audit } from "@/server/audit";

/** Asks the payment provider for a refund; it is only marked refunded by the provider webhook. */
export const POST = route({ auth: "admin" }, async ({ req, user, ip }) => {
  const input = await parseJson(req, refundRequestSchema);
  const refund = await requestRefund(user!.id, input.orderId, input.amount, input.reason);
  await audit({ actorId: user!.id, action: "refund.request", targetType: "ORDER", targetId: input.orderId, metadata: { amount: input.amount, reason: input.reason ?? null }, ip });
  return { refund: { id: refund.id, status: refund.status } };
});

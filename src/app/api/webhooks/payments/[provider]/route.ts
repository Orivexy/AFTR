import { errorResponse } from "@/server/http";
import { getPaymentProvider } from "@/server/monetization/payments";
import { applyProviderEvent } from "@/server/monetization/refunds";
import { audit } from "@/server/audit";

/**
 * Payment provider webhooks — the ONLY entry point that can mark payments
 * as paid or refunds as succeeded. Answers 503 until a provider exists.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: id } = await params;
    const provider = getPaymentProvider();
    if (provider.id !== id) return Response.json({ error: "unknown provider" }, { status: 404 });
    const event = await provider.parseWebhook(req);
    await applyProviderEvent(event);
    await audit({ actorId: null, action: `payments.webhook.${event.type}`, targetType: "PAYMENT", targetId: event.providerPaymentId ?? event.providerRefundId });
    return Response.json({ received: true });
  } catch (err) {
    return errorResponse(err);
  }
}

import "server-only";
import { ApiError } from "../errors";

/**
 * Payment provider abstraction. To go live, implement this interface
 * (e.g. StripeProvider) and return it from getPaymentProvider(). Payment and
 * refund statuses must only change inside `handleWebhook`, after verifying
 * the provider signature — never from the client or the admin panel.
 */
export interface CheckoutSession {
  providerPaymentId: string;
  redirectUrl: string;
}

export interface ProviderEvent {
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded" | "refund.failed";
  providerPaymentId?: string;
  providerRefundId?: string;
  amount?: number;
  failureReason?: string;
}

export interface PaymentProvider {
  id: string;
  createCheckout(input: { orderId: string; amount: number; currency: string; description: string; customerEmail: string }): Promise<CheckoutSession>;
  refund(input: { providerPaymentId: string; amount: number; reason?: string }): Promise<{ providerRefundId: string }>;
  /** Verifies the signature and parses the event. Throws on invalid signatures. */
  parseWebhook(request: Request): Promise<ProviderEvent>;
}

class NoPaymentProvider implements PaymentProvider {
  id = "none";
  private fail(): never {
    throw new ApiError(503, "No hay ningún proveedor de pagos configurado.", "PAYMENTS_NOT_CONFIGURED");
  }
  async createCheckout(): Promise<CheckoutSession> {
    this.fail();
  }
  async refund(): Promise<{ providerRefundId: string }> {
    this.fail();
  }
  async parseWebhook(): Promise<ProviderEvent> {
    this.fail();
  }
}

export function getPaymentProvider(): PaymentProvider {
  // Intentionally no real provider yet (see docs/monetization.md).
  return new NoPaymentProvider();
}

/**
 * Price breakdown for ticket orders. Pure and framework-free so it can be
 * unit tested and reused by any provider. All amounts are integer cents and
 * rates are basis points (100 bps = 1 %). No rate is hard-coded here: they
 * come from a CommissionRule configured by an admin.
 *
 * Conventions:
 * - `subtotal` is what the tickets cost (tax-inclusive when taxIncluded).
 * - The platform fee is added on top for the buyer when feesPaidByBuyer,
 *   otherwise it is deducted from the organizer.
 * - The payment provider fee is borne by the platform (reduces platformNet).
 */
export interface FeeRule {
  platformFeeBps: number;
  platformFeeFixed: number;
  providerFeeBps: number;
  providerFeeFixed: number;
  taxRateBps: number;
  taxIncluded: boolean;
  feesPaidByBuyer: boolean;
}

export interface OrderLine {
  unitPrice: number;
  quantity: number;
}

export interface OrderBreakdown {
  subtotal: number;
  platformFee: number;
  providerFee: number;
  tax: number;
  total: number;
  organizerAmount: number;
  platformNet: number;
}

const bps = (amount: number, rate: number) => Math.round((amount * rate) / 10_000);

function assertInt(n: number, name: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
}

export function calculateOrder(lines: OrderLine[], rule: FeeRule): OrderBreakdown {
  if (!lines.length) throw new Error("An order needs at least one line");
  for (const l of lines) {
    assertInt(l.unitPrice, "unitPrice");
    assertInt(l.quantity, "quantity");
    if (l.quantity === 0) throw new Error("quantity must be > 0");
  }
  for (const [k, v] of Object.entries(rule)) if (typeof v === "number") assertInt(v, k);

  const tickets = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const platformFee = subtotal === 0 ? 0 : bps(subtotal, rule.platformFeeBps) + rule.platformFeeFixed * tickets;

  const tax = rule.taxIncluded
    ? subtotal - Math.round((subtotal * 10_000) / (10_000 + rule.taxRateBps))
    : bps(subtotal, rule.taxRateBps);

  const total = subtotal + (rule.taxIncluded ? 0 : tax) + (rule.feesPaidByBuyer ? platformFee : 0);
  const providerFee = total === 0 ? 0 : bps(total, rule.providerFeeBps) + rule.providerFeeFixed;
  const organizerAmount = subtotal + (rule.taxIncluded ? 0 : tax) - (rule.feesPaidByBuyer ? 0 : platformFee);

  return {
    subtotal,
    platformFee,
    providerFee,
    tax,
    total,
    organizerAmount: Math.max(0, organizerAmount),
    platformNet: platformFee - providerFee,
  };
}

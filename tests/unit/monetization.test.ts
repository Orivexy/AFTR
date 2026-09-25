import { describe, expect, it } from "vitest";
import { calculateOrder, type FeeRule } from "@/server/monetization/fees";
import { isAdmin, isBusinessRole, isStaff } from "@/lib/roles";
import { businessOwnerUpdateSchema, eventInputSchema, orderCreateSchema } from "@/lib/validators";

const rule = (r: Partial<FeeRule> = {}): FeeRule => ({
  platformFeeBps: 0, platformFeeFixed: 0, providerFeeBps: 0, providerFeeFixed: 0, taxRateBps: 0, taxIncluded: true, feesPaidByBuyer: true, ...r,
});

describe("order breakdown", () => {
  it("no fees configured → organizer gets everything", () => {
    expect(calculateOrder([{ unitPrice: 1500, quantity: 2 }], rule())).toEqual({ subtotal: 3000, platformFee: 0, providerFee: 0, tax: 0, total: 3000, organizerAmount: 3000, platformNet: 0 });
  });
  it("buyer pays the platform fee; provider fee reduces platform net", () => {
    const b = calculateOrder([{ unitPrice: 2000, quantity: 1 }], rule({ platformFeeBps: 500, platformFeeFixed: 50, providerFeeBps: 150, providerFeeFixed: 25 }));
    expect(b.platformFee).toBe(150); // 5 % + 0.50 €
    expect(b.total).toBe(2150);
    expect(b.providerFee).toBe(57); // 1.5 % of 21.50 € + 0.25 €
    expect(b.organizerAmount).toBe(2000);
    expect(b.platformNet).toBe(93);
  });
  it("organizer pays the platform fee", () => {
    const b = calculateOrder([{ unitPrice: 2000, quantity: 1 }], rule({ platformFeeBps: 1000, feesPaidByBuyer: false }));
    expect(b.total).toBe(2000);
    expect(b.organizerAmount).toBe(1800);
  });
  it("tax included vs added", () => {
    expect(calculateOrder([{ unitPrice: 1210, quantity: 1 }], rule({ taxRateBps: 2100 })).tax).toBe(210);
    const added = calculateOrder([{ unitPrice: 1000, quantity: 1 }], rule({ taxRateBps: 2100, taxIncluded: false }));
    expect(added.tax).toBe(210);
    expect(added.total).toBe(1210);
  });
  it("free tickets have no fees", () => {
    expect(calculateOrder([{ unitPrice: 0, quantity: 3 }], rule({ platformFeeFixed: 50, providerFeeFixed: 25 })).total).toBe(0);
  });
  it("rejects invalid input", () => {
    expect(() => calculateOrder([], rule())).toThrow();
    expect(() => calculateOrder([{ unitPrice: 10.5, quantity: 1 }], rule())).toThrow();
    expect(() => calculateOrder([{ unitPrice: 100, quantity: 0 }], rule())).toThrow();
  });
});

describe("roles", () => {
  it("commercial roles never get staff powers", () => {
    expect(isStaff("VENUE")).toBe(false);
    expect(isStaff("ORGANIZER")).toBe(false);
    expect(isBusinessRole("VENUE")).toBe(true);
    expect(isStaff("MODERATOR")).toBe(true);
    expect(isAdmin("MODERATOR")).toBe(false);
  });
});

describe("commerce inputs", () => {
  it("event input never carries owner or amounts", () => {
    const parsed = eventInputSchema.parse({
      title: "Test", category: "fiesta", citySlug: "barcelona", locationName: "Plaça", lat: 41.4, lng: 2.15, date: "2026-10-02", startTime: "23:00", isFree: true,
      organizerId: "hacker", businessId: "x", total: 1, ticketing: "NIVEX",
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("organizerId");
    expect(parsed).not.toHaveProperty("businessId");
    expect(parsed).not.toHaveProperty("total");
  });
  it("orders only accept ids and quantities (no prices)", () => {
    const parsed = orderCreateSchema.parse({ eventId: "cabcdefghijkl", items: [{ ticketTypeId: "cabcdefghijkm", quantity: 2, price: 1 }], total: 0 } as Record<string, unknown>);
    expect(parsed.items[0]).toEqual({ ticketTypeId: "cabcdefghijkm", quantity: 2 });
    expect(parsed).not.toHaveProperty("total");
  });
  it("owners cannot send staff-only business fields", () => {
    expect(businessOwnerUpdateSchema.safeParse({ plan: "PLAN_BUSINESS" }).success).toBe(false);
    expect(businessOwnerUpdateSchema.safeParse({ contactPhone: "600" }).success).toBe(true);
  });
});

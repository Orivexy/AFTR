import "server-only";
import { db } from "../db";

/** Read models for the commerce sections of the admin panel. */
export async function commerceStats() {
  const [businesses, verified, orders, paid, gross, activeSubs, activePromos, pendingRefunds, rules, paidEvents] = await Promise.all([
    db.businessProfile.count(),
    db.businessProfile.count({ where: { verification: "VERIFIED" } }),
    db.order.count(),
    db.order.count({ where: { status: "PAID" } }),
    db.order.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { total: true, platformFee: true } }),
    db.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    db.promotion.count({ where: { status: "ACTIVE" } }),
    db.refund.count({ where: { status: { in: ["REQUESTED", "PENDING"] } } }),
    db.commissionRule.count({ where: { isActive: true } }),
    db.event.count({ where: { pricing: "PAID", status: "PUBLISHED" } }),
  ]);
  return {
    businesses, verified, orders, paid, activeSubs, activePromos, pendingRefunds, rules, paidEvents,
    grossCents: gross._sum.total ?? 0,
    platformFeeCents: gross._sum.platformFee ?? 0,
  };
}

export function listCommissionRules() {
  return db.commissionRule.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], include: { business: { select: { tradeName: true } } } });
}

export function listPlans() {
  return db.plan.findMany({ orderBy: { code: "asc" } });
}

export function listBusinesses(q?: string) {
  return db.businessProfile.findMany({
    where: q ? { OR: [{ tradeName: { contains: q, mode: "insensitive" } }, { owner: { profile: { username: { contains: q.toLowerCase() } } } }] } : {},
    // Pending requests first.
    orderBy: [{ verification: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      owner: { select: { email: true, role: true, profile: { select: { username: true } } } },
      venue: { select: { slug: true, name: true } },
      requestedVenue: { select: { slug: true, name: true } },
      _count: { select: { events: true, subscriptions: true, transactions: true, promotions: true } },
    },
  });
}

export function listOrders(take = 50) {
  return db.order.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { profile: { select: { username: true } } } }, event: { select: { title: true, slug: true } } },
  });
}

export function listPayments(take = 50) {
  return db.payment.findMany({ orderBy: { createdAt: "desc" }, take, include: { order: { select: { number: true } } } });
}

export function listRefunds(take = 50) {
  return db.refund.findMany({ orderBy: { createdAt: "desc" }, take, include: { order: { select: { number: true } } } });
}

export function listPromotions() {
  return db.promotion.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      business: { select: { tradeName: true } },
      event: { select: { title: true, slug: true } },
      venue: { select: { name: true, slug: true } },
      post: { select: { id: true, caption: true } },
    },
  });
}

export function listPaidEvents(take = 50) {
  return db.event.findMany({
    where: { pricing: "PAID" },
    orderBy: { startsAt: "desc" },
    take,
    select: { id: true, slug: true, title: true, startsAt: true, priceMin: true, priceMax: true, currency: true, ticketProvider: true, salesStatus: true, capacity: true, status: true, business: { select: { tradeName: true } } },
  });
}

export function listAuditLogs(take = 100) {
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { profile: { select: { username: true } } } } } });
}

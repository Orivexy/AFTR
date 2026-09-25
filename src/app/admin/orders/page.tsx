import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { listOrders, listPayments, listRefunds } from "@/server/services/admin-commerce";
import { monetizationFlags } from "@/server/monetization/flags";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata = { title: "Pedidos y pagos" };

const TABS = [
  { value: "orders", label: "Pedidos" },
  { value: "payments", label: "Pagos" },
  { value: "refunds", label: "Reembolsos" },
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdminPage();
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.value === raw)?.value ?? "orders";
  const rows =
    tab === "orders"
      ? (await listOrders()).map((o) => ({ id: o.id, cols: [o.number, `@${o.user.profile?.username ?? "?"}`, o.event.title, formatMoney(o.total, o.currency), o.status, timeAgo(o.createdAt)] }))
      : tab === "payments"
        ? (await listPayments()).map((p) => ({ id: p.id, cols: [p.order.number, p.provider, p.providerPaymentId ?? "—", formatMoney(p.amount, p.currency), p.status, timeAgo(p.createdAt)] }))
        : (await listRefunds()).map((r) => ({ id: r.id, cols: [r.order.number, r.reason ?? "—", r.providerRefundId ?? "—", formatMoney(r.amount, r.currency), r.status, timeAgo(r.createdAt)] }));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Pedidos y pagos</h1>
      {!monetizationFlags.tickets && (
        <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">La venta de entradas está desactivada: no se crean pedidos ni pagos. Los reembolsos solo se marcan como completados cuando el proveedor de pagos lo confirma.</p>
      )}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link key={t.value} href={`/admin/orders?tab=${t.value}`} className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-semibold", tab === t.value ? "bg-fg text-ink" : "border border-line-strong")}>{t.label}</Link>
        ))}
      </div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-2 gap-2 p-3 md:grid-cols-6">
            {r.cols.map((c, i) => <span key={i} className={cn("truncate", i === 0 && "font-semibold")}>{c}</span>)}
          </div>
        ))}
        {!rows.length && <p className="p-8 text-center text-muted">Sin registros</p>}
      </div>
    </div>
  );
}

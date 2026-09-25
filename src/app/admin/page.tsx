import Link from "next/link";
import { adminStats } from "@/server/services/admin";
import { formatNumber } from "@/lib/text";

export default async function AdminHome() {
  const s = await adminStats();
  const cards = [
    { label: "Reportes abiertos", value: s.openReports, href: "/admin/reports", alert: s.openReports > 0 },
    { label: "Eventos pendientes", value: s.pendingEvents, href: "/admin/events?status=PENDING", alert: s.pendingEvents > 0 },
    { label: "Usuarios", value: s.users, href: "/admin/users", sub: `+${s.newUsers} esta semana` },
    { label: "Suspendidos", value: s.suspended, href: "/admin/users" },
    { label: "Eventos publicados", value: s.events, href: "/admin/events" },
    { label: "Locales activos", value: s.venues, href: "/admin/venues" },
    { label: "Publicaciones", value: s.posts, href: "/admin/posts" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Resumen</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`rounded-2xl border p-4 hover:bg-surface-2 ${c.alert ? "border-warn/40 bg-warn/5" : "border-line bg-surface"}`}>
            <p className="text-[13px] text-muted">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{formatNumber(c.value)}</p>
            {c.sub && <p className="text-[12px] text-faint">{c.sub}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeEuro, Briefcase, CalendarClock, CalendarDays, Flag, Image as ImageIcon, LayoutDashboard, Map as MapIcon, Megaphone, Radar, ReceiptText, ScrollText, Store, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/reports", label: "Reportes", icon: Flag },
  { href: "/admin/events", label: "Eventos", icon: CalendarDays },
  { href: "/admin/discovery", label: "Event Discovery", icon: Radar },
  { href: "/admin/map-data", label: "Map Data", icon: MapIcon },
  { href: "/admin/event-data", label: "Event Data", icon: CalendarClock },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/venues", label: "Locales", icon: Store },
  { href: "/admin/posts", label: "Publicaciones", icon: ImageIcon },
  // Commerce (admins only)
  { href: "/admin/monetization", label: "Monetización", icon: BadgeEuro, admin: true },
  { href: "/admin/businesses", label: "Negocios", icon: Briefcase, admin: true },
  { href: "/admin/orders", label: "Pedidos y pagos", icon: ReceiptText, admin: true },
  { href: "/admin/promotions", label: "Patrocinado", icon: Megaphone, admin: true },
  { href: "/admin/audit", label: "Auditoría", icon: ScrollText, admin: true },
];

export function AdminNav({ openReports, isAdmin }: { openReports: number; isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.filter((i) => !i.admin || isAdmin).map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cn("flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold", active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")}>
            <i.icon className="size-4" />
            {i.label}
            {i.href === "/admin/reports" && openReports > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 text-[11px] text-white">{openReports}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

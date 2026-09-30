"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, Plus, Search, Shield } from "lucide-react";
import { Logo } from "./logo";
import { CityPicker, type CityOption } from "./city-picker";
import { CreateSheet } from "./create-sheet";
import { NotificationBell } from "./notification-bell";
import { DESKTOP_NAV, MOBILE_NAV, isActive } from "./nav-items";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { useSession } from "@/components/providers/session-provider";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { cn } from "@/lib/cn";
import { isStaff } from "@/lib/roles";

interface ShellProps {
  cities: CityOption[];
  city: CityOption;
  children: React.ReactNode;
}

/** Routes that render edge-to-edge (vertical feed) without the mobile header. */
const IMMERSIVE = ["/social"];

export function AppShell({ cities, city, children }: ShellProps) {
  const pathname = usePathname();
  const user = useSession();
  const requireAuth = useRequireAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const immersive = IMMERSIVE.some((p) => pathname.startsWith(p));

  const openCreate = () => requireAuth("Inicia sesión para publicar fotos, vídeos y eventos") && setCreateOpen(true);

  return (
    <>
      {/* Desktop top bar */}
      <header className="glass sticky top-0 z-40 hidden border-b border-line md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 lg:gap-6 lg:px-6">
          <Logo />
          <nav className="flex items-center gap-1">
            {DESKTOP_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-2 py-2 text-sm font-semibold transition-colors lg:px-3.5",
                  (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-1 lg:gap-2">
            <CityPicker cities={cities} current={city} className="px-3 hover:bg-surface-2" labelClassName="max-lg:hidden" />
            <Link href="/search" aria-label="Buscar" className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2">
              <Search className="size-5" />
            </Link>
            {user ? (
              <>
                {isStaff(user.role) && (
                  <Link href="/admin" aria-label="Administración" className="pressable grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
                    <Shield className="size-5" />
                  </Link>
                )}
                <NotificationBell />
                <button onClick={openCreate} aria-label="Crear" className={buttonClass("primary", "md", "ml-1")}>
                  <Plus className="size-4" /> <span className="hidden lg:inline">Crear</span>
                </button>
                <Link href={`/u/${user.username}`} aria-label="Tu perfil" className="pressable ml-1">
                  <Avatar user={user} size={36} />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "md")}>
                  Entrar
                </Link>
                <Link href="/register" className={buttonClass("primary", "md", "max-lg:hidden")}>
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      {!immersive && (
        <header className="glass safe-top sticky top-0 z-40 border-b border-line md:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <Logo className="text-[17px]" />
            <CityPicker cities={cities} current={city} className="ml-auto px-2" />
            <Link href="/map" aria-label="Mapa" className="pressable grid size-10 place-items-center rounded-full">
              <MapIcon className="size-[21px]" />
            </Link>
            {user && <NotificationBell className="-mr-2" />}
          </div>
        </header>
      )}

      <main className={cn(immersive ? "" : "pb-28 md:pb-16")}>
        <div key={pathname} className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className={cn("safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line md:hidden", immersive ? "bg-ink" : "glass")} aria-label="Navegación principal">
        <div className="grid h-16 grid-cols-5">
          {MOBILE_NAV.map((item) => {
            if (!item.icon) {
              return (
                <button key={item.href} onClick={openCreate} aria-label="Crear" className="grid place-items-center">
                  <span className="pressable grid h-9 w-12 place-items-center rounded-2xl bg-volt text-on-volt shadow-[0_0_24px_-4px_rgb(215_255_58/0.6)]">
                    <Plus className="size-5" strokeWidth={2.6} />
                  </span>
                </button>
              );
            }
            const href = item.href === "/me" ? (user ? `/u/${user.username}` : "/login?next=/me") : item.href;
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={href} className={cn("pressable flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold", active ? "text-fg" : "text-faint")}>
                {item.href === "/me" && user ? (
                  <span className={cn("rounded-full p-px", active && "ring-2 ring-fg")}>
                    <Avatar user={user} size={24} />
                  </span>
                ) : (
                  <Icon className="size-[23px]" strokeWidth={active ? 2.4 : 1.9} />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}


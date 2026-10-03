"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Home, LogIn, Map as MapIcon, Play, Plus, RefreshCw, Search, Settings, Shield, User, Users } from "lucide-react";
import { Logo } from "./logo";
import { CityPicker, type CityOption } from "./city-picker";
import { CreateSheet } from "./create-sheet";
import { NotificationBell } from "./notification-bell";
import { isActive } from "./nav-items";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/components/providers/session-provider";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { cn } from "@/lib/cn";
import { isStaff } from "@/lib/roles";

export type DesktopPlatform = "mac" | "win" | "linux";

interface DesktopBridge {
  platform: string;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  toggleFullScreen(): Promise<void>;
  close(): Promise<void>;
  state(): Promise<{ fullscreen: boolean; maximized: boolean }>;
  onState(cb: (s: { fullscreen: boolean; maximized: boolean }) => void): () => void;
  update?: {
    state(): Promise<UpdateState>;
    check(): Promise<void>;
    install(): Promise<void>;
    onState(cb: (s: UpdateState) => void): () => void;
  };
}
type UpdateState = { status: "idle" | "checking" | "downloading" | "ready" | "latest" | "error" | "unsupported"; version: string | null; percent: number };
const bridge = () => (typeof window === "undefined" ? null : ((window as unknown as { appDesktop?: DesktopBridge }).appDesktop ?? null));

/**
 * The desktop app's window, in the style of a macOS app: unified title bar
 * with back/forward and a search field; translucent sidebar with grouped
 * sections. Window buttons are Windows-style (minimize, maximize, close) on
 * the right, on every system.
 */
export function MacShell({ platform, cities, city, children }: { platform: DesktopPlatform; cities: CityOption[]; city: CityOption; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSession();
  const requireAuth = useRequireAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const openCreate = () => requireAuth("Inicia sesión para publicar fotos, vídeos y eventos") && setCreateOpen(true);

  useEffect(() => {
    const b = bridge();
    if (!b) return;
    void b.state().then((s) => setFullscreen(s.fullscreen));
    return b.onState((s) => setFullscreen(s.fullscreen));
  }, []);

  const sections: Array<{ title: string; items: Array<{ href: string; label: string; icon: typeof Home; show?: boolean }> }> = [
    {
      title: "Explorar",
      items: [
        { href: "/", label: "Inicio", icon: Home },
        { href: "/map", label: "Mapa", icon: MapIcon },
        { href: "/events", label: "Eventos", icon: CalendarDays },
      ],
    },
    {
      title: "Comunidad",
      items: [
        { href: "/social", label: "Social", icon: Play },
        { href: "/people", label: "Personas", icon: Users },
      ],
    },
    {
      title: "Tú",
      items: user
        ? [
            { href: "/notifications", label: "Notificaciones", icon: Bell },
            { href: `/u/${user.username}`, label: "Perfil", icon: User },
            { href: "/settings", label: "Ajustes", icon: Settings },
            { href: "/admin", label: "Administración", icon: Shield, show: isStaff(user.role) },
          ]
        : [{ href: "/login", label: "Entrar", icon: LogIn }],
    },
  ];
  const selected = (href: string) => (href === "/discover" ? pathname.startsWith("/discover") : href === "/map" ? pathname.startsWith("/map") : isActive(pathname, href));

  return (
    <div className="mac-ui">
      {/* Unified title bar */}
      <header className="mac-titlebar fixed inset-x-0 top-0 z-50 flex h-[var(--mac-titlebar)] items-center gap-2 border-b border-white/[0.07] pl-2">
        <div className="mac-no-drag flex items-center gap-0.5">
          <button onClick={() => router.back()} aria-label="Atrás" className="mac-tool">
            <ChevronLeft className="size-[18px]" />
          </button>
          <button onClick={() => router.forward()} aria-label="Adelante" className="mac-tool">
            <ChevronRight className="size-[18px]" />
          </button>
        </div>
        <Link href="/search" className="mac-no-drag mac-search mx-auto flex h-7 w-full max-w-[420px] items-center gap-2 rounded-[7px] px-2.5 text-[13px] text-white/45">
          <Search className="size-3.5" />
          Buscar locales y eventos…
        </Link>
        <div className="mac-no-drag flex items-center gap-1">
          <CityPicker cities={cities} current={city} className="mac-city" labelClassName="max-lg:hidden" />
          {user && <NotificationBell />}
          <button onClick={openCreate} aria-label="Crear" className="mac-tool">
            <Plus className="size-[18px]" />
          </button>
          {user ? (
            <Link href={`/u/${user.username}`} aria-label="Tu perfil" className="ml-1">
              <Avatar user={user} size={26} />
            </Link>
          ) : (
            <Link href="/register" className="mac-button ml-1">
              Crear cuenta
            </Link>
          )}
        </div>
        <WindowControls fullscreen={fullscreen} />
      </header>

      {/* Sidebar */}
      <aside className="mac-sidebar fixed top-[var(--mac-titlebar)] bottom-0 left-0 z-40 flex w-[64px] flex-col overflow-y-auto border-r border-white/[0.07] px-2 pt-3 pb-4 lg:w-[var(--mac-sidebar)] lg:px-3">
        <div className="mb-4 hidden px-2 lg:block">
          <Logo className="text-[16px]" />
        </div>
        {sections.map((s) => (
          <nav key={s.title} className="mb-4" aria-label={s.title}>
            <p className="mb-1 hidden px-2 text-[11px] font-semibold text-white/35 lg:block">{s.title}</p>
            {s.items
              .filter((i) => i.show !== false)
              .map((i) => {
                const active = selected(i.href);
                return (
                  <Link key={i.href} href={i.href} title={i.label} className={cn("mac-row", active && "is-active")}>
                    <i.icon className="size-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    <span className="truncate max-lg:hidden">{i.label}</span>
                  </Link>
                );
              })}
          </nav>
        ))}
        <UpdateButton />
        <p className="mt-2 hidden px-2 text-[11px] leading-snug text-white/30 lg:block">Barcelona · locales verificados uno a uno; fotos, horarios y eventos de sus webs oficiales.</p>
      </aside>

      <main className="min-h-dvh pt-[var(--mac-titlebar)] pl-[64px] lg:pl-[var(--mac-sidebar)]">
        <div key={pathname} className="animate-fade-in">
          {children}
        </div>
      </main>

      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/** Window buttons (minimize, maximize/restore, close) in the Windows style, on every system. */
function WindowControls({ fullscreen }: { fullscreen: boolean }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const b = bridge();
    if (!b) return;
    void b.state().then((st) => setMaximized(st.maximized));
    return b.onState((st) => setMaximized(st.maximized));
  }, []);
  const b = bridge();
  if (!b) return null;
  return (
    <div className="mac-no-drag ml-2 flex h-full items-stretch" role="group" aria-label="Ventana">
      <button onClick={() => void b.minimize()} aria-label="Minimizar" className="win-control">
        <svg viewBox="0 0 10 10"><path d="M0 5h10" /></svg>
      </button>
      <button onClick={() => void (fullscreen ? b.toggleFullScreen() : b.toggleMaximize())} aria-label={fullscreen ? "Salir de pantalla completa" : maximized ? "Restaurar" : "Maximizar"} className="win-control">
        {fullscreen || maximized ? (
          <svg viewBox="0 0 10 10"><path d="M2 0.5h7.5V8M0.5 2h7.5v7.5H0.5z" /></svg>
        ) : (
          <svg viewBox="0 0 10 10"><path d="M0.5 0.5h9v9h-9z" /></svg>
        )}
      </button>
      <button onClick={() => void b.close()} aria-label="Cerrar" className="win-control win-close">
        <svg viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" /></svg>
      </button>
    </div>
  );
}

/** Bottom left of the sidebar: app updates (desktop only). */
function UpdateButton() {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const u = bridge()?.update;
    if (!u) return;
    void u.state().then(setState);
    return u.onState(setState);
  }, []);
  const u = bridge()?.update;
  if (!u || !state) return null;
  const ready = state.status === "ready";
  const label = ready
    ? `Actualizar a ${state.version}`
    : state.status === "downloading"
      ? `Descargando ${state.version ?? ""} · ${state.percent} %`
      : state.status === "checking"
        ? "Buscando actualizaciones…"
        : state.status === "latest"
          ? "Al día · buscar de nuevo"
          : state.status === "error"
            ? "Sin conexión · reintentar"
            : "Buscar actualizaciones";
  const busy = state.status === "checking" || state.status === "downloading";
  return (
    <button
      type="button"
      onClick={() => void (ready ? u.install() : u.check())}
      disabled={busy}
      title={label}
      className={cn("mac-row mt-auto w-full text-left", ready && "!bg-volt font-bold !text-on-volt [&_svg]:!text-on-volt")}
    >
      <RefreshCw className={cn("size-[17px] shrink-0", busy && "animate-spin")} strokeWidth={ready ? 2.2 : 1.8} />
      <span className="truncate max-lg:hidden">{label}</span>
    </button>
  );
}

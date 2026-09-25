import { Compass, Home, Map, CalendarDays, Play, User } from "lucide-react";

export const DESKTOP_NAV = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/discover", label: "Descubrir", icon: Compass },
  { href: "/map", label: "Mapa", icon: Map },
  { href: "/events", label: "Eventos", icon: CalendarDays },
  { href: "/social", label: "Social", icon: Play },
] as const;

export const MOBILE_NAV = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/discover", label: "Descubrir", icon: Compass },
  { href: "#create", label: "Crear", icon: null },
  { href: "/social", label: "Social", icon: Play },
  { href: "/me", label: "Perfil", icon: User },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/me") return pathname.startsWith("/u/") || pathname === "/me" || pathname.startsWith("/settings");
  if (href === "/discover") return pathname.startsWith("/discover") || pathname.startsWith("/search") || pathname.startsWith("/map");
  return pathname.startsWith(href);
}

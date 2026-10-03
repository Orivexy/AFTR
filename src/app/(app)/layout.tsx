import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { MacShell, type DesktopPlatform } from "@/components/layout/mac-shell";
import { getCurrentCity, listCities } from "@/server/services/cities";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [city, cities, h] = await Promise.all([getCurrentCity(), listCities(), headers()]);
  const cityProps = { city: { slug: city.slug, name: city.name }, cities: cities.map((c) => ({ slug: c.slug, name: c.name })) };
  // The desktop app (Electron) identifies itself: it gets the macOS-style window.
  const desktop = h.get("user-agent")?.match(/AppDesktop\/(mac|win|linux)/)?.[1] as DesktopPlatform | undefined;
  if (desktop) return <MacShell platform={desktop} {...cityProps}>{children}</MacShell>;
  return <AppShell {...cityProps}>{children}</AppShell>;
}

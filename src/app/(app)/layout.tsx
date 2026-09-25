import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCity, listCities } from "@/server/services/cities";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [city, cities] = await Promise.all([getCurrentCity(), listCities()]);
  return (
    <AppShell city={{ slug: city.slug, name: city.name }} cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}>
      {children}
    </AppShell>
  );
}

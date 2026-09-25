import type { Metadata } from "next";
import Link from "next/link";
import { VenueCard } from "@/components/venues/venue-card";
import { getCurrentCity } from "@/server/services/cities";
import { listVenues, type VenueSort } from "@/server/services/venues";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Discotecas y locales" };

const SORTS: Array<{ value: VenueSort; label: string }> = [
  { value: "popular", label: "Populares" },
  { value: "rating", label: "Mejor valorados" },
  { value: "name", label: "A–Z" },
];

export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort: raw } = await searchParams;
  const sort = SORTS.find((s) => s.value === raw)?.value ?? "popular";
  const city = await getCurrentCity();
  const venues = await listVenues({ cityId: city.id, sort, limit: 48 });
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6 md:pt-10">
      <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Discotecas</h1>
      <p className="text-muted">Locales en {city.name}</p>
      <nav className="scrollbar-none -mx-4 my-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {SORTS.map((s) => (
          <Link key={s.value} href={`/venues?sort=${s.value}`} className={cn("pressable h-9 shrink-0 rounded-full px-4 text-[13px] leading-9 font-semibold", sort === s.value ? "bg-fg text-ink" : "border border-line-strong hover:bg-surface-2")}>
            {s.label}
          </Link>
        ))}
      </nav>
      {venues.items.length ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {venues.items.map((v) => <VenueCard key={v.id} venue={v} />)}
        </div>
      ) : (
        <EmptyState title={`Aún no hay locales en ${city.name}`}>Estamos llegando a tu ciudad.</EmptyState>
      )}
    </div>
  );
}

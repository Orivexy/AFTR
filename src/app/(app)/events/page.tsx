import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EventList } from "@/components/events/event-list";
import { NightlifeFilters } from "@/components/venues/nightlife-filters";
import { buttonClass } from "@/components/ui/button";
import { getCurrentCity } from "@/server/services/cities";
import { listEvents } from "@/server/services/events";
import { listZones } from "@/server/services/venues";
import { eventFilterFor, nightlifeFilter } from "@/lib/nightlife";
import { cn } from "@/lib/cn";
import type { DateFilter } from "@/lib/time";

export const metadata: Metadata = { title: "Eventos" };

const TABS: Array<{ value: DateFilter; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "weekend", label: "Este fin de semana" },
  { value: "upcoming", label: "Próximamente" },
];

type Search = { when?: string; tipo?: string; zona?: string; q?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const when = (TABS.find((t) => t.value === sp.when)?.value ?? "upcoming") as DateFilter;
  const filter = nightlifeFilter(sp.tipo);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const city = await getCurrentCity();
  const zones = await listZones(city.id);
  const zone = sp.zona && zones.includes(sp.zona) ? sp.zona : undefined;
  const kind = eventFilterFor(filter.value);
  const initial = await listEvents({ cityId: city.id, timezone: city.timezone, when, ...kind, district: zone, q, limit: 20 });

  const params = new URLSearchParams({ when, limit: "20" });
  if (kind.categories) params.set("category", kind.categories.join(","));
  if (kind.venueTypes) params.set("venueType", kind.venueTypes.join(","));
  if (zone) params.set("zone", zone);
  if (q) params.set("q", q);
  const tabHref = (w: string) => {
    const p = new URLSearchParams({ when: w });
    if (filter.value !== "todos") p.set("tipo", filter.value);
    if (zone) p.set("zona", zone);
    if (q) p.set("q", q);
    return `/events?${p}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 md:px-6 md:pt-10">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Agenda</h1>
          <p className="text-muted">Fiestas, conciertos, sesiones DJ y festivales en {city.name}</p>
        </div>
        <Link href="/events/new" className={buttonClass("primary", "md")}>
          <Plus className="size-4" /> Crear evento
        </Link>
      </div>
      <nav className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={tabHref(t.value)}
            scroll={false}
            className={cn("pressable h-9 shrink-0 rounded-full px-4 text-[13px] leading-9 font-semibold", when === t.value ? "bg-fg text-ink" : "border border-line-strong hover:bg-surface-2")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mb-5">
        <NightlifeFilters basePath="/events" filter={filter.value} zone={zone} q={q} zones={zones} keep={{ when }} />
      </div>
      <EventList key={params.toString()} initial={initial} endpoint={`/api/events?${params}`} layout="rows" emptyTitle="No hay eventos con estos filtros" />
    </div>
  );
}

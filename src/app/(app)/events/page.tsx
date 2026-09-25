import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EventList } from "@/components/events/event-list";
import { buttonClass } from "@/components/ui/button";
import { getCurrentCity } from "@/server/services/cities";
import { listEvents } from "@/server/services/events";
import { cn } from "@/lib/cn";
import type { DateFilter } from "@/lib/time";

export const metadata: Metadata = { title: "Eventos" };

const TABS: Array<{ value: DateFilter; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "weekend", label: "Este fin de semana" },
  { value: "upcoming", label: "Próximamente" },
];

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ when?: string }> }) {
  const { when: raw } = await searchParams;
  const when = (TABS.find((t) => t.value === raw)?.value ?? "upcoming") as DateFilter;
  const city = await getCurrentCity();
  const initial = await listEvents({ cityId: city.id, timezone: city.timezone, when, limit: 20 });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 md:px-6 md:pt-10">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Agenda</h1>
          <p className="text-muted">Eventos en {city.name}</p>
        </div>
        <Link href="/events/new" className={buttonClass("primary", "md")}>
          <Plus className="size-4" /> Crear evento
        </Link>
      </div>
      <nav className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/events?when=${t.value}`}
            scroll={false}
            className={cn("pressable h-9 shrink-0 rounded-full px-4 text-[13px] leading-9 font-semibold", when === t.value ? "bg-fg text-ink" : "border border-line-strong hover:bg-surface-2")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <EventList key={when} initial={initial} endpoint={`/api/events?when=${when}&limit=20`} layout="rows" emptyTitle="No hay eventos en estas fechas" />
    </div>
  );
}

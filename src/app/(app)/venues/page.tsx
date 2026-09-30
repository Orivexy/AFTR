import type { Metadata } from "next";
import type { VenueType } from "@prisma/client";
import { VenueCard } from "@/components/venues/venue-card";
import { NightlifeFilters } from "@/components/venues/nightlife-filters";
import { TicketCard } from "@/components/events/ticket-card";
import { getCurrentCity } from "@/server/services/cities";
import { listVenues, listZones } from "@/server/services/venues";
import { listEvents } from "@/server/services/events";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { eventFilterFor, nightlifeFilter } from "@/lib/nightlife";

export const metadata: Metadata = { title: "Ocio nocturno" };

type Search = { tipo?: string; zona?: string; q?: string };

export default async function VenuesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filter = nightlifeFilter(sp.tipo);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const city = await getCurrentCity();
  const zones = await listZones(city.id);
  const zone = sp.zona && zones.includes(sp.zona) ? sp.zona : undefined;

  const [venues, events] = await Promise.all([
    listVenues({ cityId: city.id, types: filter.venueTypes as VenueType[] | undefined, district: zone, q, sort: "name", limit: 60 }),
    listEvents({ cityId: city.id, timezone: city.timezone, when: "upcoming", ...eventFilterFor(filter.value), district: zone, q, limit: 8 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-10 md:px-6 md:pt-10">
      <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Ocio nocturno</h1>
      <p className="mb-5 text-muted">Discotecas, clubs, salas y espacios de eventos de {city.name}, comprobados uno a uno.</p>
      <NightlifeFilters basePath="/venues" filter={filter.value} zone={zone} q={q} zones={zones} />

      <section className="mt-6">
        <SectionHeader title={`Lugares${venues.items.length ? ` · ${venues.items.length}` : ""}`} />
        {venues.items.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {venues.items.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </div>
        ) : (
          <EmptyState title="Ningún lugar con estos filtros">Prueba con otra zona o quita la búsqueda.</EmptyState>
        )}
      </section>

      {events.items.length > 0 && (
        <section className="mt-10">
          <SectionHeader title="Próximos eventos" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {events.items.map((e) => (
              <TicketCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

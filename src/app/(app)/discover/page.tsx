import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Map as MapIcon } from "lucide-react";
import { DiscoverFilters } from "@/components/events/discover-filters";
import { EventList } from "@/components/events/event-list";
import { EventCard } from "@/components/events/event-card";
import { VenueCard } from "@/components/venues/venue-card";
import { UserRow } from "@/components/social/user-row";
import { Rail } from "@/components/ui/rail";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { getCurrentCity } from "@/server/services/cities";
import { discoverFilterOptions, listEvents } from "@/server/services/events";
import { listVenues } from "@/server/services/venues";
import { suggestedUsers } from "@/server/services/users";
import { getSessionUser } from "@/server/auth/session";
import { parseDiscover, type DiscoverParams } from "@/lib/discover-params";
import { dateNightWindow } from "@/lib/time";
import { CalendarX2 } from "lucide-react";

export const metadata: Metadata = { title: "Descubrir" };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<DiscoverParams> }) {
  const sp = await searchParams;
  const [city, user] = await Promise.all([getCurrentCity(), getSessionUser()]);
  const f = parseDiscover(sp);
  const options = await discoverFilterOptions(city.id);
  const base = { cityId: city.id, timezone: city.timezone };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6 md:pt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Descubrir</h1>
          <p className="text-muted">Todo lo que pasa en {city.name}</p>
        </div>
        <Link href="/map" className={buttonClass("secondary", "md")}>
          <MapIcon className="size-4" /> Mapa
        </Link>
      </div>
      <div className="sticky top-14 z-30 -mx-4 bg-ink/90 px-4 py-3 backdrop-blur md:top-16 md:mx-0 md:px-0">
        <Suspense>
          <DiscoverFilters options={options} />
        </Suspense>
      </div>

      <div className="pt-4">
        {f.hasFilters ? (
          <Filtered base={base} f={f} />
        ) : (
          <Curated base={base} cityName={city.name} userId={user?.id} />
        )}
      </div>
    </div>
  );
}

async function Filtered({ base, f }: { base: { cityId: string; timezone: string }; f: ReturnType<typeof parseDiscover> }) {
  if (f.waitingForLocation) return <p className="py-10 text-center text-muted">Buscando tu ubicación…</p>;
  const initial = await listEvents({
    ...base,
    when: f.date ? undefined : (f.when ?? "upcoming"),
    window: f.date ? dateNightWindow(f.date, base.timezone) : undefined,
    venueId: f.venueId,
    categories: f.categories,
    genres: f.genres,
    maxPrice: f.maxPrice,
    near: f.near,
    limit: 12,
  });
  const qs = new URLSearchParams(f.qs);
  if (!qs.has("when") && !qs.has("date")) qs.set("when", "upcoming");
  const onlyDate = (f.date || f.when) && !f.maxPrice && !f.categories && !f.genres && !f.venueId && !f.near;
  return (
    <EventList
      key={qs.toString()}
      initial={initial}
      endpoint={`/api/events?${qs}`}
      emptyTitle={onlyDate ? "No hay eventos disponibles para esta fecha." : "No hay eventos con estos filtros."}
      emptyText={onlyDate ? "Prueba con otro día o mira los locales abiertos en el mapa." : "Prueba con otras fechas o quita algún filtro."}
    />
  );
}

async function Curated({ base, cityName, userId }: { base: { cityId: string; timezone: string }; cityName: string; userId?: string }) {
  const [tonight, popular, fresh, topVenues, people] = await Promise.all([
    listEvents({ ...base, when: "today", sort: "popular", limit: 10 }),
    listEvents({ ...base, when: "week", sort: "popular", limit: 10 }),
    listEvents({ ...base, when: "upcoming", sort: "newest", limit: 10 }),
    listVenues({ cityId: base.cityId, sort: "rating", limit: 10 }).then((p) => ({ ...p, items: p.items.filter((v) => v.ratingCount > 0) })),
    suggestedUsers(userId, base.cityId, 6),
  ]);
  const railItem = "w-[72vw] sm:w-[280px]";
  if (!tonight.items.length && !popular.items.length && !fresh.items.length && !topVenues.items.length) {
    return (
      <EmptyState
        icon={<CalendarX2 className="size-5" />}
        title={`Todavía no hay eventos ni locales en ${cityName}.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/events/new" className={buttonClass("primary", "sm")}>Crear un evento</Link>
            <Link href="/map" className={buttonClass("secondary", "sm")}>Ver el mapa</Link>
          </div>
        }
      >
        Los locales y eventos se importan automáticamente de fuentes públicas y los publican locales, organizadores y la comunidad. Vuelve pronto o publica el primero.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-10">
      {tonight.items.length > 0 && (
        <section>
          <SectionHeader eyebrow="Ahora" title="Esta noche" action={<Link href="/discover?when=today" className="text-sm font-semibold text-muted hover:text-fg">Ver todo</Link>} />
          <Rail itemClassName={railItem}>{tonight.items.map((e) => <EventCard key={e.id} event={e} />)}</Rail>
        </section>
      )}
      {!tonight.items.length && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">No hay eventos disponibles para esta noche.</p>
      )}
      {popular.items.length > 0 && (
        <section>
          <SectionHeader title={`Popular en ${cityName}`} action={<Link href="/discover?when=week" className="text-sm font-semibold text-muted hover:text-fg">Ver todo</Link>} />
          <Rail itemClassName={railItem}>{popular.items.map((e) => <EventCard key={e.id} event={e} />)}</Rail>
        </section>
      )}
      {topVenues.items.length > 0 && (
        <section>
          <SectionHeader title="Más valorados" action={<Link href="/venues?sort=rating" className="text-sm font-semibold text-muted hover:text-fg">Ver todos</Link>} />
          <Rail itemClassName="w-[70vw] sm:w-[280px]">{topVenues.items.map((v) => <VenueCard key={v.id} venue={v} />)}</Rail>
        </section>
      )}
      {fresh.items.length > 0 && (
        <section>
          <SectionHeader title="Eventos nuevos" />
          <Rail itemClassName={railItem}>{fresh.items.map((e) => <EventCard key={e.id} event={e} />)}</Rail>
        </section>
      )}
      {people.length > 0 && (
        <section className="max-w-xl">
          <SectionHeader title="Gente a la que seguir" action={<Link href="/people" className="text-sm font-semibold text-muted hover:text-fg">Ver más</Link>} />
          <div className="divide-y divide-line">
            {people.map((p) => <UserRow key={p.id} user={p} following={false} showFollow={p.id !== userId} />)}
          </div>
        </section>
      )}
    </div>
  );
}

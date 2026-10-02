import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { TicketCard } from "@/components/events/ticket-card";
import { HomeMap } from "@/components/map/home-map";
import { EmptyState } from "@/components/ui/misc";
import { getCurrentCity } from "@/server/services/cities";
import { listEvents } from "@/server/services/events";
import { getMapConfig, getMapPlaces } from "@/server/services/map";

export const dynamic = "force-dynamic";

/** Home: the clubs on a large map, then the next events. */
export default async function HomePage() {
  const city = await getCurrentCity();
  const [places, upcoming] = await Promise.all([
    getMapPlaces(city),
    listEvents({ cityId: city.id, timezone: city.timezone, when: "upcoming", sort: "soonest", limit: 12 }),
  ]);

  return (
    <div>
      <HomeMap config={getMapConfig()} places={places} center={{ lat: city.lat, lng: city.lng }} cityName={city.name} />

      <section className="mx-auto max-w-7xl px-4 pt-2 pb-10 md:px-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-[26px] font-bold tracking-tight md:text-[30px]">Próximos eventos</h2>
          <Link href="/events" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
            Ver todo <ArrowRight className="size-4" />
          </Link>
        </div>
        {upcoming.items.length ? (
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcoming.items.map((e, i) => <TicketCard key={e.id} event={e} priority={i < 2} />)}
          </div>
        ) : (
          <EmptyState title="Aún no hay eventos anunciados" icon={<Sparkles className="size-5" />}>
            Los eventos de las discotecas de {city.name} aparecen aquí en cuanto se publican.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

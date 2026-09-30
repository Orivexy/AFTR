import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { TicketCard } from "@/components/events/ticket-card";
import { VenueCard } from "@/components/venues/venue-card";
import { HomeMap } from "@/components/map/home-map";
import { Rail } from "@/components/ui/rail";
import { EmptyState } from "@/components/ui/misc";
import { getCurrentCity } from "@/server/services/cities";
import { listEvents } from "@/server/services/events";
import { listVenues } from "@/server/services/venues";
import { getMapConfig, getMapPlaces } from "@/server/services/map";

export const dynamic = "force-dynamic";

/** Home: the map first, then the next parties with photo, price and "Comprar", then the clubs. */
export default async function HomePage() {
  const city = await getCurrentCity();
  const [upcoming, venues, places] = await Promise.all([
    listEvents({ cityId: city.id, timezone: city.timezone, when: "upcoming", sort: "soonest", limit: 12 }),
    listVenues({ cityId: city.id, sort: "popular", limit: 12 }),
    getMapPlaces(city),
  ]);

  return (
    <div>
      <HomeMap config={getMapConfig()} places={places} center={{ lat: city.lat, lng: city.lng }} cityName={city.name} />

      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-2 pb-10 md:px-6">
        <section>
          <Header title="Próximas fiestas" href="/events" />
          {upcoming.items.length ? (
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcoming.items.map((e, i) => <TicketCard key={e.id} event={e} priority={i < 2} />)}
            </div>
          ) : (
            <EmptyState title="Aún no hay fiestas anunciadas" icon={<Sparkles className="size-5" />}>
              Las fiestas de las discotecas de {city.name} aparecen aquí en cuanto se publican.
            </EmptyState>
          )}
        </section>

        {venues.items.length > 0 && (
          <section>
            <Header title="Discotecas" href="/venues" />
            <Rail itemClassName="w-[70vw] sm:w-[260px]">
              {venues.items.map((v) => <VenueCard key={v.id} venue={v} />)}
            </Rail>
          </section>
        )}
      </div>
    </div>
  );
}

function Header({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="font-display text-[26px] font-bold tracking-tight md:text-[30px]">{title}</h2>
      <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        Ver todo <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

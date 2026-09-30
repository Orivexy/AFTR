import Link from "next/link";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { EventCard, EventRow } from "@/components/events/event-card";
import { VenueCard } from "@/components/venues/venue-card";
import { PostGrid } from "@/components/feed/post-grid";
import { HomeMap } from "@/components/map/home-map";
import { getMapConfig, getMapPlaces } from "@/server/services/map";
import { Rail } from "@/components/ui/rail";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { getCurrentCity } from "@/server/services/cities";
import { listEvents } from "@/server/services/events";
import { listVenues } from "@/server/services/venues";
import { getFeed } from "@/server/services/posts";
import { getSessionUser } from "@/server/auth/session";
import { formatLongDate, nightWindow } from "@/lib/time";
import { TZDate } from "@date-fns/tz";

export const dynamic = "force-dynamic";

const QUICK = [
  { label: "Hoy", href: "/discover?when=today" },
  { label: "Este finde", href: "/discover?when=weekend" },
  { label: "Gratis", href: "/discover?price=free" },
  { label: "Techno", href: "/discover?genre=techno" },
  { label: "Reggaeton", href: "/discover?genre=reggaeton" },
  { label: "House", href: "/discover?genre=house" },
];

function greeting(tz: string) {
  const d = new TZDate(Date.now(), tz);
  const h = d.getHours();
  const day = formatLongDate(new Date(), tz).split(" ")[0];
  if (h >= 19 || h < 6) return `${day} noche`;
  if (h >= 14) return `${day} tarde`;
  return day;
}

export default async function HomePage() {
  const [city, user] = await Promise.all([getCurrentCity(), getSessionUser()]);
  const base = { cityId: city.id, timezone: city.timezone };

  // Priority: today → tomorrow → next 7 days → following weeks (nights run 06:00 → 06:00).
  const night = (offset: number) => nightWindow(city.timezone, offset).from;
  const [featured, today, tomorrow, week, fm, upcoming, venues, feed, places] = await Promise.all([
    listEvents({ ...base, when: "upcoming", featured: true, limit: 6 }),
    listEvents({ ...base, when: "today", limit: 8 }),
    listEvents({ ...base, when: "tomorrow", sort: "soonest", limit: 10 }),
    listEvents({ ...base, window: { from: night(2), to: night(7) }, limit: 10 }),
    listEvents({ ...base, when: "upcoming", categories: ["fm"], limit: 8 }),
    listEvents({ ...base, window: { from: night(7), to: night(120) }, limit: 10 }),
    listVenues({ cityId: city.id, sort: "popular", limit: 10 }),
    getFeed({ mode: "foryou", viewerId: user?.id, cityId: city.id, limit: 9 }),
    getMapPlaces(city),
  ]);
  const hero = featured.items[0] ?? week.items[0] ?? upcoming.items[0];

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6">
      {/* Greeting + search */}
      <section className="pt-5 pb-6 md:pt-10 md:pb-8">
        <p className="text-sm font-semibold text-muted">
          {greeting(city.timezone)} en {city.name}
        </p>
        <h1 className="mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-tight text-balance md:text-5xl">
          ¿Qué hay <span className="text-volt">hoy</span>?
        </h1>
        <Link href="/search" className="pressable mt-5 flex h-12 items-center gap-3 rounded-full border border-line-strong bg-surface px-4 text-muted hover:bg-surface-2 md:max-w-xl">
          <Search className="size-5" />
          <span className="text-[15px]">Fiestas, discotecas, barrios, gente…</span>
        </Link>
        <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="pressable inline-flex h-9 shrink-0 items-center rounded-full border border-line-strong px-4 text-[13px] font-semibold hover:bg-surface-2">
              {q.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-10 md:grid-cols-[1fr_380px] md:gap-10">
        <div className="min-w-0 space-y-10">
          <HomeMap config={getMapConfig()} places={places} center={{ lat: city.lat, lng: city.lng }} cityName={city.name} />

          {hero && (
            <section>
              <EventCard event={hero} size="lg" priority />
            </section>
          )}

          {/* HOY */}
          <section>
            <SectionHeader
              eyebrow="Esta noche"
              title="Hoy"
              action={
                <Link href="/discover?when=today" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
                  Ver todo <ArrowRight className="size-4" />
                </Link>
              }
            />
            {today.items.length ? (
              <div className="divide-y divide-line">
                {today.items.map((e) => (
                  <div key={e.id} className="py-1">
                    <EventRow event={e} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Hoy está tranquilo" icon={<Sparkles className="size-5" />} action={<Link href="/events/new" className={buttonClass("primary", "sm")}>Crea un plan</Link>}>
                No hay eventos publicados para esta noche en {city.name}. Mira el fin de semana o crea el tuyo.
              </EmptyState>
            )}
          </section>

          {tomorrow.items.length > 0 && (
            <section>
              <SectionHeader title="Mañana" action={<Link href="/discover?when=tomorrow" className="text-sm font-semibold text-muted hover:text-fg">Ver todo</Link>} />
              <Rail itemClassName="w-[72vw] sm:w-[280px]">
                {tomorrow.items.map((e) => <EventCard key={e.id} event={e} />)}
              </Rail>
            </section>
          )}

          {week.items.length > 0 && (
            <section>
              <SectionHeader title="Próximos 7 días" action={<Link href="/discover?when=week" className="text-sm font-semibold text-muted hover:text-fg">Ver todo</Link>} />
              <Rail itemClassName="w-[72vw] sm:w-[280px]">
                {week.items.map((e) => <EventCard key={e.id} event={e} />)}
              </Rail>
            </section>
          )}

          {fm.items.length > 0 && (
            <section>
              <SectionHeader eyebrow="Fiestas de barrio" title="FM cercanas" action={<Link href="/discover?category=fm" className="text-sm font-semibold text-muted hover:text-fg">Ver todo</Link>} />
              <Rail itemClassName="w-[72vw] sm:w-[280px]">
                {fm.items.map((e) => <EventCard key={e.id} event={e} />)}
              </Rail>
            </section>
          )}

          <section>
            <SectionHeader title="Discotecas populares" action={<Link href="/venues" className="text-sm font-semibold text-muted hover:text-fg">Ver todas</Link>} />
            {venues.items.length ? (
              <Rail itemClassName="w-[70vw] sm:w-[280px]">
                {venues.items.map((v) => <VenueCard key={v.id} venue={v} />)}
              </Rail>
            ) : (
              <p className="text-sm text-muted">Aún no hay locales en {city.name}. Se añaden automáticamente al sincronizar con OpenStreetMap y cuando los locales se registran.</p>
            )}
          </section>

          <section>
            <SectionHeader title="Próximas semanas" action={<Link href="/events" className="text-sm font-semibold text-muted hover:text-fg">Agenda</Link>} />
            {upcoming.items.length ? (
              <Rail itemClassName="w-[72vw] sm:w-[280px]">
                {upcoming.items.map((e) => <EventCard key={e.id} event={e} />)}
              </Rail>
            ) : (
              <p className="text-sm text-muted">Aún no hay eventos anunciados más adelante.</p>
            )}
          </section>
        </div>

        {/* Social column (sidebar on desktop, section on mobile) */}
        <aside className="space-y-6 md:sticky md:top-24 md:self-start">
          <section>
            <SectionHeader eyebrow="Social" title="Lo que se está viviendo" action={<Link href="/social" className="text-sm font-semibold text-muted hover:text-fg">Abrir</Link>} />
            {feed.items.length ? <PostGrid posts={feed.items} /> : <EmptyState title="Aún no hay publicaciones" />}
          </section>
        </aside>
      </div>
    </div>
  );
}

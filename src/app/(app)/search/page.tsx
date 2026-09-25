import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, SearchX } from "lucide-react";
import { SearchBox } from "@/components/forms/search-box";
import { EventRow } from "@/components/events/event-card";
import { VenueCard } from "@/components/venues/venue-card";
import { UserRow } from "@/components/social/user-row";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { Rail } from "@/components/ui/rail";
import { getCurrentCity } from "@/server/services/cities";
import { globalSearch } from "@/server/services/search";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Buscar" };

const SUGGESTIONS = ["Gràcia", "Poblenou", "Techno", "Reggaeton", "FM", "Gratis", "House", "Sala"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [city, user] = await Promise.all([getCurrentCity(), getSessionUser()]);
  const results = q.trim() ? await globalSearch(q, city.id, 8) : null;
  const followed = user && results?.users.length
    ? new Set((await db.follow.findMany({ where: { followerId: user.id, followingId: { in: results.users.map((u) => u.id) } }, select: { followingId: true } })).map((f) => f.followingId))
    : new Set<string>();
  const empty = results && !results.events.length && !results.venues.length && !results.users.length && !results.places.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-5 md:pt-10">
      <SearchBox initial={q} />

      {!results && (
        <section>
          <p className="mb-3 text-[13px] font-bold tracking-wider text-muted uppercase">Prueba con</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="pressable rounded-full border border-line-strong px-4 py-2 text-sm font-semibold hover:bg-surface-2">
                {s}
              </Link>
            ))}
          </div>
        </section>
      )}

      {empty && (
        <EmptyState icon={<SearchX className="size-5" />} title={`Nada para “${q}”`}>
          Prueba con un barrio, un estilo de música o el nombre de un local en {city.name}.
        </EmptyState>
      )}

      {results?.places.length ? (
        <section>
          <SectionHeader title="Zonas" />
          <div className="flex flex-wrap gap-2">
            {results.places.map((p) => (
              <Link key={p.name} href={`/search?q=${encodeURIComponent(p.name)}`} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 hover:bg-surface-2">
                <MapPin className="size-4 text-volt" />
                <span className="font-semibold">{p.name}</span>
                <span className="text-[13px] text-muted">{p.count} locales</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {results?.events.length ? (
        <section>
          <SectionHeader title={`Eventos${results.places.length ? ` en ${results.places[0]!.name}` : ""}`} />
          <div className="divide-y divide-line">
            {results.events.map((e) => (
              <div key={e.id} className="py-1">
                <EventRow event={e} showDay />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {results?.venues.length ? (
        <section>
          <SectionHeader title="Discotecas y locales" />
          <Rail itemClassName="w-[70vw] sm:w-[260px]">{results.venues.map((v) => <VenueCard key={v.id} venue={v} />)}</Rail>
        </section>
      ) : null}

      {results?.users.length ? (
        <section>
          <SectionHeader title="Personas" />
          <div className="divide-y divide-line">
            {results.users.map((u) => <UserRow key={u.id} user={u} following={followed.has(u.id)} showFollow={u.id !== user?.id} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { MapView } from "./map-view";
import type { MapMarker } from "./types";
import { filterPlaces, DEFAULT_FILTERS } from "@/lib/map-filters";
import type { MapConfig } from "@/server/services/map";
import type { MapPlace } from "@/lib/types";

/** Home hero: the night map of the city, full width; tap a pin to open its page. */
export function HomeMap({ config, places, center, cityName }: { config: MapConfig; places: MapPlace[]; center: { lat: number; lng: number }; cityName: string }) {
  const router = useRouter();
  const results = useMemo(() => filterPlaces(places, DEFAULT_FILTERS, { coords: null, sortByDistance: false }), [places]);
  const markers = useMemo<MapMarker[]>(
    () =>
      results.map(({ place: p, events, live, open }) => ({
        id: p.id, lat: p.lat, lng: p.lng, label: p.name, live, open: open === true,
        variant: p.kind === "venue" ? "club" : (events[0]?.category ?? "fiesta"),
      })),
    [results],
  );
  const clubs = results.filter((r) => r.place.kind === "venue").length;
  const parties = results.reduce((n, r) => n + r.events.length, 0);
  const open = (id: string | null) => {
    const p = results.find((r) => r.place.id === id)?.place;
    if (p) router.push(p.kind === "venue" ? `/venues/${p.slug}` : `/events/${p.slug}`);
  };

  return (
    <section className="relative h-[64vh] min-h-[440px] max-h-[780px] overflow-hidden">
      <MapView config={config} center={center} zoom={13} markers={markers} onSelect={open} cluster wheelZoom={false} className="size-full" />
      {/* Soft fade into the page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4 md:p-6">
        <div className="glass pointer-events-auto max-w-md rounded-3xl border border-line-strong p-5 shadow-2xl shadow-black/40">
          <p className="text-[12px] font-bold tracking-[0.18em] text-volt uppercase">Esta noche · {cityName}</p>
          <h1 className="mt-1 font-display text-[28px] leading-[1.05] font-bold md:text-[34px]">¿A qué discoteca vas?</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {clubs} {clubs === 1 ? "discoteca" : "discotecas"} · {parties} {parties === 1 ? "fiesta" : "fiestas"} con entradas
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/search" className="pressable flex h-11 flex-1 items-center gap-2 rounded-full border border-line-strong bg-ink/60 px-4 text-[14px] text-muted hover:text-fg">
              <Search className="size-4" /> Buscar discoteca o fiesta
            </Link>
            <Link href="/map" className="pressable grid h-11 place-items-center rounded-full bg-volt px-4 text-[14px] font-bold text-on-volt">
              <span className="flex items-center gap-1.5">
                Mapa <ArrowRight className="size-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { MapView } from "./map-view";
import type { MapMarker } from "./types";
import { buttonClass } from "@/components/ui/button";
import { filterPlaces, DEFAULT_FILTERS } from "@/lib/map-filters";
import type { MapConfig } from "@/server/services/map";
import type { MapPlace } from "@/lib/types";

/** Map of tonight on the home page: real clubs and events, one tap to their page. */
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
  const events = results.reduce((n, r) => n + r.events.length, 0);
  const open = (id: string | null) => {
    const p = results.find((r) => r.place.id === id)?.place;
    if (p) router.push(p.kind === "venue" ? `/venues/${p.slug}` : `/events/${p.slug}`);
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-volt text-on-volt">
          <MapIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold">Mapa de la noche</p>
          <p className="truncate text-sm text-muted">
            {cityName} · {results.length ? `${clubs} ${clubs === 1 ? "local" : "locales"} · ${events} ${events === 1 ? "evento" : "eventos"} próximos` : "Los locales se añaden al sincronizar con OpenStreetMap"}
          </p>
        </div>
        <Link href="/map" className={buttonClass("secondary", "sm", "shrink-0")}>
          Abrir <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="h-[260px] md:h-[340px]">
        <MapView config={config} center={center} zoom={12} markers={markers} onSelect={open} cluster wheelZoom={false} className="size-full" />
      </div>
    </section>
  );
}

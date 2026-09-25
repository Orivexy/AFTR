"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, LocateFixed, MapPin, X } from "lucide-react";
import { MapView } from "./map-view";
import type { MapMarker } from "./map-canvas";
import { Cover } from "@/components/ui/cover";
import { Chip, LiveDot } from "@/components/ui/misc";
import { RatingPill } from "@/components/venues/venue-card";
import { buttonClass } from "@/components/ui/button";
import { useLocation } from "@/components/providers/location-provider";
import { isOpenNow } from "@/components/venues/opening-hours";
import { distanceKm, formatDistance } from "@/lib/geo";
import { formatPrice } from "@/lib/money";
import { formatRelativeDay, formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { MapConfig } from "@/server/services/map";
import type { MapPlace } from "@/lib/types";

const FILTERS = [
  { value: "all", label: "Todo" },
  { value: "venue", label: "Discotecas" },
  { value: "fm", label: "FM" },
  { value: "fiesta", label: "Fiestas" },
  { value: "live", label: "Ahora" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function matches(p: MapPlace, f: Filter) {
  if (f === "all") return true;
  if (f === "venue") return p.kind === "venue";
  if (f === "live") return Boolean(p.currentEvent);
  if (f === "fiesta") return p.kind === "event" && p.category !== "fm";
  return p.category === f;
}

export function NightMap({ config, places, center }: { config: MapConfig; places: MapPlace[]; center: { lat: number; lng: number } }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState(center);
  const { coords, status, request } = useLocation();

  const visible = useMemo(() => places.filter((p) => matches(p, filter)), [places, filter]);
  const markers = useMemo<MapMarker[]>(
    () => visible.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, variant: p.kind === "venue" ? "venue" : p.category, label: p.name, live: Boolean(p.currentEvent) })),
    [visible],
  );
  const selected = places.find((p) => p.id === selectedId) ?? null;

  const select = (id: string | null) => {
    setSelectedId(id);
    const p = places.find((x) => x.id === id);
    if (p) setFocus({ lat: p.lat, lng: p.lng });
  };

  const locate = () => {
    if (coords) setFocus({ ...coords });
    else request();
  };

  return (
    <div className="relative h-[calc(100dvh-3.5rem-4rem)] md:grid md:h-[calc(100dvh-4rem)] md:grid-cols-[380px_1fr]">
      {/* Desktop list */}
      <aside className="hidden overflow-y-auto border-r border-line md:block">
        <div className="sticky top-0 z-10 space-y-3 bg-ink/95 p-4 backdrop-blur">
          <h1 className="font-display text-2xl font-bold">Mapa</h1>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-line px-2">
          {visible.map((p) => (
            <li key={p.id}>
              <button onClick={() => select(p.id)} className={cn("flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface", selectedId === p.id && "bg-surface")}>
                <Cover imageKey={p.coverKey} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-[13px] text-muted">{p.currentEvent ? `Ahora: ${p.currentEvent.title}` : p.nextEvent ? `${formatRelativeDay(p.nextEvent.startsAt, p.timezone)} · ${p.nextEvent.title}` : p.address}</p>
                </div>
                {p.currentEvent && <LiveDot />}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative size-full">
        <MapView config={config} center={focus} zoom={13} markers={markers} selectedId={selectedId} onSelect={select} user={coords} className="size-full" />

        {/* Mobile filters */}
        <div className="scrollbar-none absolute inset-x-0 top-3 z-[500] flex gap-2 overflow-x-auto px-3 md:hidden">
          {FILTERS.map((f) => (
            <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)} className={filter === f.value ? "" : "glass"}>
              {f.label}
            </Chip>
          ))}
        </div>

        <button onClick={locate} aria-label="Centrar en mi ubicación" className={cn("glass pressable absolute right-3 z-[500] grid size-11 place-items-center rounded-full border border-line-strong", selected ? "bottom-[15.5rem] md:bottom-6" : "bottom-4 md:bottom-6")}>
          <LocateFixed className={cn("size-5", coords ? "text-volt" : "", status === "locating" && "animate-spin")} />
        </button>

        {selected && <PlaceCard place={selected} onClose={() => setSelectedId(null)} coords={coords} />}
      </div>
    </div>
  );
}

function PlaceCard({ place, onClose, coords }: { place: MapPlace; onClose: () => void; coords: { lat: number; lng: number } | null }) {
  const ev = place.currentEvent ?? place.nextEvent;
  const href = place.kind === "venue" ? `/venues/${place.slug}` : `/events/${place.slug}`;
  const open = place.kind === "venue" && isOpenNow(place.openingHours, place.timezone);
  const price = ev ? formatPrice(ev.priceMin, ev.priceMax, place.currency) : formatPrice(place.priceMin, place.priceMax, place.currency);

  return (
    <div className="animate-fade-up absolute inset-x-3 bottom-3 z-[600] overflow-hidden rounded-[1.5rem] border border-line-strong bg-surface shadow-2xl md:right-auto md:bottom-6 md:left-6 md:w-[380px]">
      <div className="flex gap-3 p-3">
        <Cover imageKey={place.coverKey} alt={place.name} sizes="96px" className="size-24 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate font-display text-[17px] font-semibold">{place.name}</h2>
            <button onClick={onClose} aria-label="Cerrar" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
              <X className="size-4" />
            </button>
          </div>
          <p className="flex items-center gap-1 truncate text-[13px] text-muted">
            <MapPin className="size-3 shrink-0" /> <span className="truncate">{place.address}</span>
            {coords && <span className="shrink-0">· {formatDistance(distanceKm(coords, place))}</span>}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {place.ratingCount != null && <RatingPill avg={place.ratingAvg ?? 0} count={place.ratingCount} />}
            {place.kind === "venue" && <span className={cn("text-[12px] font-semibold", open ? "text-volt" : "text-faint")}>{open ? "Abierto" : "Cerrado ahora"}</span>}
          </div>
          <p className="mt-1 text-[13px] font-bold">{price}</p>
        </div>
      </div>
      {ev && (
        <Link href={`/events/${ev.slug}`} className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[13px] hover:bg-surface-2">
          {place.currentEvent ? (
            <span className="flex items-center gap-1.5 font-bold text-volt">
              <LiveDot /> Ahora
            </span>
          ) : (
            <span className="font-bold text-volt">Próximo</span>
          )}
          <span className="truncate font-semibold">{ev.title}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-muted">
            <Clock className="size-3.5" />
            {formatRelativeDay(ev.startsAt, place.timezone)} {formatTime(ev.startsAt, place.timezone)}
            {ev.endsAt && `–${formatTime(ev.endsAt, place.timezone)}`}
          </span>
        </Link>
      )}
      {place.kind === "venue" && place.currentEvent && place.nextEvent && (
        <Link href={`/events/${place.nextEvent.slug}`} className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[13px] hover:bg-surface-2">
          <span className="font-bold text-muted">Después</span>
          <span className="truncate">{place.nextEvent.title}</span>
          <span className="ml-auto shrink-0 text-muted">{formatRelativeDay(place.nextEvent.startsAt, place.timezone)}</span>
        </Link>
      )}
      <div className="border-t border-line p-3">
        <Link href={href} className={buttonClass("primary", "md", "w-full")}>
          {place.kind === "venue" ? "Ver lugar" : "Ver evento"} <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

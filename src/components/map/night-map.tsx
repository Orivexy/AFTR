"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { VENUE_TYPE_LABEL } from "@/lib/nightlife";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronUp, Clock, Globe2, List, LocateFixed, Map as MapIcon, MapPin, Navigation, Search, SlidersHorizontal, Star, Ticket, X } from "lucide-react";
import { MapView } from "./map-view";
import type { MapMarker } from "./types";
import { Cover } from "@/components/ui/cover";
import { Chip, LiveDot } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { useLocation } from "@/components/providers/location-provider";
import { GENRES } from "@/config/taxonomy";
import { formatDistance } from "@/lib/geo";
import { formatPrice } from "@/lib/money";
import { formatEventTime, formatRelativeDay, formatTime } from "@/lib/time";
import { openingStatus } from "@/lib/hours";
import {
  DEFAULT_FILTERS, PRICE_OPTIONS, TYPE_OPTIONS, WHEN_OPTIONS, activeFilterCount, directionsUrl, filterPlaces, isLive, lowestPrice, ticketLink,
  type FilteredPlace, type MapFilters, type TypeFilter, type WhenFilter,
} from "@/lib/map-filters";
import { parseSearchIntent } from "@/lib/search-intent";
import { cn } from "@/lib/cn";
import type { MapConfig } from "@/server/services/map";
import type { MapEvent, MapPlace } from "@/lib/types";

const TYPE_LABEL = VENUE_TYPE_LABEL;
const CATEGORY_LABEL: Record<string, string> = { fm: "FM", fiesta: "Fiesta", discoteca: "Fiesta de club", concierto: "Concierto", dj: "Sesión DJ", festival: "Festival", especial: "Evento especial", tematica: "Noche temática", otro: "Evento" };
const genreName = (slug: string) => GENRES.find((g) => g.slug === slug)?.name ?? slug;
/** "Gratis" / "Desde 12 €", or null when no price was published. */
function priceFromLabel(r: FilteredPlace): string | null {
  const min = lowestPrice(r.place, r.events);
  if (min == null) return null;
  return min === 0 ? "Gratis" : `Desde ${formatPrice(min, null, r.place.currency)}`;
}

interface Props {
  config: MapConfig;
  places: MapPlace[];
  center: { lat: number; lng: number };
  cityName: string;
  initialWhen?: WhenFilter;
  initialQuery?: string;
}

export function NightMap({ config, places, center, cityName, initialWhen = "all", initialQuery = "" }: Props) {
  const [filters, setFilters] = useState<MapFilters>({ ...DEFAULT_FILTERS, when: initialWhen });
  const [query, setQuery] = useState(initialQuery);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState(center);
  const [recenterKey, setRecenterKey] = useState(0);
  const [panel, setPanel] = useState<"none" | "list" | "filters">("none");
  const [satellite, setSatellite] = useState(false);
  // First view: every place in frame, clear of the search bar and sheet on phones and of the buttons on the right.
  const [fit] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? { top: 130, bottom: 150, left: 20, right: 20 } : { top: 40, bottom: 40, left: 40, right: 80 },
  );
  const { coords, status, request } = useLocation();
  const wantsCenterOnUser = useRef(false);

  // Words in the search box become filters ("techno hoy", "gratis", "clubs cerca de mí").
  const intent = useMemo(() => parseSearchIntent(query, [{ slug: "city", name: cityName }]), [query, cityName]);
  const effective = useMemo<MapFilters>(
    () => ({
      ...filters,
      when: intent.when ?? filters.when,
      price: intent.free ? "free" : filters.price,
      types: [...new Set([...filters.types, ...intent.types])],
      genres: [...new Set([...filters.genres, ...intent.genres])],
      query: intent.text,
    }),
    [filters, intent],
  );
  const byDistance = (sortByDistance || intent.near) && Boolean(coords);
  useEffect(() => {
    if (intent.near && !coords && status === "idle") request();
  }, [intent.near, coords, status, request]);

  const results = useMemo(() => filterPlaces(places, effective, { coords, sortByDistance: byDistance }), [places, effective, coords, byDistance]);
  const markers = useMemo<MapMarker[]>(
    () =>
      results.map(({ place: p, events, live, open }) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        variant: p.kind === "venue" ? "club" : (events[0]?.category ?? "fiesta"),
        label: p.name,
        live,
        open: open === true,
      })),
    [results],
  );
  const selected = results.find((r) => r.place.id === selectedId) ?? null;

  useEffect(() => {
    if (coords && wantsCenterOnUser.current) {
      wantsCenterOnUser.current = false;
      setFocus({ ...coords });
      setRecenterKey((k) => k + 1);
    }
  }, [coords]);

  const select = (id: string | null) => {
    setSelectedId(id);
    const r = results.find((x) => x.place.id === id);
    if (r) {
      setFocus({ lat: r.place.lat, lng: r.place.lng });
      setPanel("none");
    }
  };
  const locate = () => {
    if (coords) {
      setFocus({ ...coords });
      setRecenterKey((k) => k + 1);
    } else {
      wantsCenterOnUser.current = true;
      request();
    }
  };
  const setWhen = (when: WhenFilter) => setFilters((f) => ({ ...f, when }));
  const count = activeFilterCount(filters);

  const searchBox = (
    <label className="glass flex h-12 items-center gap-2 rounded-2xl border border-line-strong px-3.5 shadow-lg shadow-black/30 md:bg-surface md:shadow-none">
      <Search className="size-[18px] shrink-0 text-muted" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Locales, fiestas, conciertos, «hoy»…"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        aria-label="Buscar en el mapa"
        enterKeyHint="search"
      />
      {query && (
        <button onClick={() => setQuery("")} aria-label="Borrar búsqueda" className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2">
          <X className="size-4" />
        </button>
      )}
    </label>
  );

  const whenChips = (glass: boolean) => (
    <div className="scrollbar-none flex gap-2 overflow-x-auto">
      <Chip active={count > 0} onClick={() => setPanel(panel === "filters" ? "none" : "filters")} className={glass && !count ? "glass" : ""} aria-expanded={panel === "filters"} aria-label="Filtros">
        <SlidersHorizontal className="size-3.5" />
        {count > 0 ? count : <span className="md:hidden">Filtros</span>}
      </Chip>
      {WHEN_OPTIONS.map((w) => (
        <Chip key={w.value} active={effective.when === w.value} onClick={() => setWhen(w.value)} className={glass && effective.when !== w.value ? "glass" : ""}>
          {w.label}
        </Chip>
      ))}
    </div>
  );

  const list = (
    <ul className="divide-y divide-line">
      {results.map((r) => (
        <li key={r.place.id}>
          <ResultRow r={r} active={r.place.id === selectedId} onClick={() => select(r.place.id)} />
        </li>
      ))}
      {!results.length && <li className="px-4 py-10 text-center text-sm text-muted">Nada con estos filtros. Prueba otra fecha o quita filtros.</li>}
    </ul>
  );

  return (
    <div className="app-viewport relative overflow-hidden md:grid md:grid-cols-[400px_1fr]">
      {/* Desktop panel */}
      <aside className="hidden min-h-0 flex-col border-r border-line md:flex">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl font-bold">Mapa</h1>
            <span className="text-sm text-muted">{results.length} en {cityName}</span>
          </div>
          {searchBox}
          {whenChips(false)}
          {panel === "filters" && <FiltersPanel filters={filters} setFilters={setFilters} sortByDistance={sortByDistance} setSortByDistance={setSortByDistance} hasCoords={Boolean(coords)} requestLocation={request} total={results.length} onClose={() => setPanel("none")} />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">{list}</div>
      </aside>

      <div className="relative size-full">
        <MapView config={config} center={focus} zoom={13} markers={markers} selectedId={selectedId} onSelect={select} user={coords} cluster zoomControls recenterKey={recenterKey} satellite={satellite} fitMarkers={initialQuery ? undefined : fit} className="size-full" />

        {/* Mobile: search + chips */}
        <div className="absolute inset-x-0 top-0 z-[500] space-y-2 p-3 md:hidden">
          {searchBox}
          {whenChips(true)}
        </div>

        <div className={cn("absolute right-3 z-[500] flex flex-col gap-2 transition-[bottom] duration-300", selected ? "bottom-[calc(20rem+1rem)] md:bottom-[7.5rem]" : "bottom-20 md:bottom-[7.5rem]")}>
          {config.satelliteUrl && (
            <button onClick={() => setSatellite((s) => !s)} aria-label={satellite ? "Ver mapa" : "Ver satélite"} aria-pressed={satellite} title={satellite ? "Mapa" : "Satélite"} className="glass pressable grid size-11 place-items-center rounded-2xl border border-line-strong shadow-lg shadow-black/30">
              {satellite ? <MapIcon className="size-5" /> : <Globe2 className="size-5" />}
            </button>
          )}
          <button onClick={locate} aria-label="Mi ubicación" className="glass pressable grid size-11 place-items-center rounded-2xl border border-line-strong shadow-lg shadow-black/30">
            <LocateFixed className={cn("size-5", coords ? "text-[#3d8bff]" : "", status === "locating" && "animate-spin")} />
          </button>
        </div>
        {status === "denied" && <p className="glass absolute top-32 left-1/2 z-[500] -translate-x-1/2 rounded-full px-3 py-1.5 text-[12px] text-muted md:top-4">Ubicación no permitida en el navegador</p>}

        {/* Mobile bottom: list peek / list / filters */}
        {!selected && (
          <div className={cn("absolute inset-x-0 bottom-0 z-[550] md:hidden", panel !== "none" && "top-24")}>
            {panel === "none" ? (
              <button onClick={() => setPanel("list")} className="glass mx-3 mb-3 flex h-12 w-[calc(100%-1.5rem)] items-center justify-between rounded-2xl border border-line-strong px-4 text-sm font-semibold shadow-lg shadow-black/40">
                <span className="flex items-center gap-2">
                  <List className="size-4" /> {results.length} {results.length === 1 ? "resultado" : "resultados"}
                </span>
                <ChevronUp className="size-4 text-muted" />
              </button>
            ) : (
              <div className="animate-sheet-up flex h-full flex-col rounded-t-[1.75rem] border-t border-line-strong bg-ink/95 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <span className="font-display text-lg font-semibold">{panel === "filters" ? "Filtros" : `${results.length} resultados`}</span>
                  <button onClick={() => setPanel("none")} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-surface-2">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
                  {panel === "filters" ? (
                    <div className="px-2">
                      <FiltersPanel filters={filters} setFilters={setFilters} sortByDistance={sortByDistance} setSortByDistance={setSortByDistance} hasCoords={Boolean(coords)} requestLocation={request} total={results.length} onClose={() => setPanel("list")} />
                    </div>
                  ) : (
                    list
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {selected && <PlaceSheet r={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

function statusLine(r: FilteredPlace): { text: string; tone: "live" | "open" | "closed" | "muted" } {
  const p = r.place;
  const liveEvent = r.events.find((e) => isLive(e));
  if (liveEvent) return { text: p.kind === "venue" ? `Ahora: ${liveEvent.title}` : "Ahora", tone: "live" };
  if (p.kind === "venue") {
    const s = openingStatus(p.openingHours, p.timezone);
    if (s) return { text: s.open ? `Abierto · ${s.label}` : s.label, tone: s.open ? "open" : "closed" };
  }
  const next = r.events[0];
  if (next) return { text: `${formatRelativeDay(next.startsAt, p.timezone)} ${formatEventTime(next.startsAt, p.timezone, next.timeUnknown)}${p.kind === "venue" ? ` · ${next.title}` : ""}`, tone: "muted" };
  return { text: p.address || p.neighborhood || "Horario no disponible", tone: "muted" };
}

function ResultRow({ r, active, onClick }: { r: FilteredPlace; active: boolean; onClick: () => void }) {
  const p = r.place;
  const st = statusLine(r);
  const price = priceFromLabel(r);
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-surface", active && "bg-surface")}>
      <Cover imageKey={p.coverKey ?? r.events[0]?.coverKey ?? null} art={p.kind === "venue" ? "club" : r.events[0]?.category} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.name}</p>
        <p className={cn("truncate text-[13px]", st.tone === "live" ? "font-semibold text-volt" : st.tone === "open" ? "text-emerald-300" : "text-muted")}>{st.text}</p>
        <p className="truncate text-[12px] text-faint">{p.kind === "venue" ? (TYPE_LABEL[p.venueType ?? ""] ?? "Local") : (CATEGORY_LABEL[r.events[0]?.category ?? ""] ?? "Evento")}{p.genres.length > 0 && ` · ${p.genres.slice(0, 2).map(genreName).join(", ")}`}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {r.live && <LiveDot />}
        {price && <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", price === "Gratis" ? "bg-emerald-400/15 text-emerald-300" : "bg-volt/15 text-volt")}>{price}</span>}
        {r.distanceKm != null && <span className="text-[12px] font-semibold text-muted">{formatDistance(r.distanceKm)}</span>}
      </div>
    </button>
  );
}

function FiltersPanel({
  filters, setFilters, sortByDistance, setSortByDistance, hasCoords, requestLocation, total, onClose,
}: {
  filters: MapFilters;
  setFilters: React.Dispatch<React.SetStateAction<MapFilters>>;
  sortByDistance: boolean;
  setSortByDistance: (v: boolean) => void;
  hasCoords: boolean;
  requestLocation: () => void;
  total: number;
  onClose: () => void;
}) {
  const toggle = <K extends "types" | "genres">(key: K, value: MapFilters[K][number]) =>
    setFilters((f) => ({ ...f, [key]: (f[key] as string[]).includes(value) ? (f[key] as string[]).filter((x) => x !== value) : [...f[key], value] }));
  return (
    <div className="animate-fade-in space-y-4 py-1">
      <FilterGroup label="Precio">
        {PRICE_OPTIONS.map((o) => (
          <Chip key={o.value} active={filters.price === o.value} onClick={() => setFilters((f) => ({ ...f, price: o.value }))}>
            {o.label}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup label="Tipo">
        {TYPE_OPTIONS.map((o) => (
          <Chip key={o.value} active={filters.types.includes(o.value)} onClick={() => toggle("types", o.value as TypeFilter)}>
            {o.label}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup label="Género">
        {GENRES.filter((g) => g.slug !== "otro").map((g) => (
          <Chip key={g.slug} active={filters.genres.includes(g.slug)} onClick={() => toggle("genres", g.slug)}>
            {g.name}
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup label="Más">
        <Chip active={filters.openNow} onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}>
          Abierto ahora
        </Chip>
        <Chip
          active={sortByDistance}
          onClick={() => {
            if (!hasCoords) requestLocation();
            setSortByDistance(!sortByDistance);
          }}
        >
          <Navigation className="size-3.5" /> Más cerca primero
        </Chip>
      </FilterGroup>
      <div className="flex gap-2 pt-1">
        <button onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, when: f.when }))} className={buttonClass("ghost", "md")}>
          Limpiar
        </button>
        <button onClick={onClose} className={buttonClass("primary", "md", "flex-1")}>
          Ver {total} {total === 1 ? "resultado" : "resultados"}
        </button>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[12px] font-bold tracking-wider text-faint uppercase">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function PlaceSheet({ r, onClose }: { r: FilteredPlace; onClose: () => void }) {
  const p = r.place;
  const [ua, setUa] = useState("");
  useEffect(() => setUa(navigator.userAgent), []); // eslint-disable-line react-hooks/set-state-in-effect -- device-specific directions link after mount
  const status = p.kind === "venue" ? openingStatus(p.openingHours, p.timezone) : null;
  const next: MapEvent | undefined = r.events[0];
  const liveNow = next && isLive(next);
  const href = p.kind === "venue" ? `/venues/${p.slug}` : `/events/${p.slug}`;
  const price = priceFromLabel(r);
  const tickets = ticketLink(r.events);

  return (
    <div className="animate-sheet-up absolute inset-x-0 bottom-0 z-[600] max-h-[80%] overflow-y-auto rounded-t-[1.75rem] border-t border-line-strong bg-ink/95 shadow-2xl backdrop-blur-xl md:inset-x-auto md:bottom-6 md:left-6 md:w-[400px] md:rounded-[1.75rem] md:border">
      <div className="relative">
        <Cover imageKey={p.coverKey ?? next?.coverKey ?? null} art={p.kind === "venue" ? "club" : next?.category} alt={p.name} sizes="400px" className="h-36 w-full" />
        <div className="image-fade absolute inset-0" />
        <button onClick={onClose} aria-label="Cerrar" className="glass absolute top-3 right-3 grid size-9 place-items-center rounded-full">
          <X className="size-4" />
        </button>
        <div className="absolute inset-x-4 bottom-3">
          <p className="text-[12px] font-bold tracking-wider text-volt uppercase">
            {p.kind === "venue" ? (TYPE_LABEL[p.venueType ?? ""] ?? "Local") : (CATEGORY_LABEL[next?.category ?? ""] ?? "Evento")}
            {p.neighborhood && <span className="text-muted"> · {p.neighborhood}</span>}
          </p>
          <h2 className="truncate font-display text-[22px] leading-tight font-bold">{p.name}</h2>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
          {p.ratingCount != null && p.ratingAvg != null && (
            <span className="flex items-center gap-1 font-bold">
              <Star className="size-3.5 text-volt" fill="currentColor" strokeWidth={0} /> {p.ratingAvg.toFixed(1).replace(".", ",")}
              <span className="font-medium text-faint">({p.ratingCount})</span>
            </span>
          )}
          {r.distanceKm != null && (
            <span className="flex items-center gap-1 text-muted">
              <MapPin className="size-3.5" /> {formatDistance(r.distanceKm)}
            </span>
          )}
          {price && <span className={cn("rounded-full px-2.5 py-0.5 font-bold", price === "Gratis" ? "bg-emerald-400/15 text-emerald-300" : "bg-volt/15 text-volt")}>{price}</span>}
          {status ? (
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", status.open ? "bg-emerald-400" : "bg-faint")} />
              <b className={status.open ? "text-emerald-300" : ""}>{status.open ? "Abierto ahora" : "Cerrado"}</b>
              <span className="text-muted">· {status.label}</span>
            </span>
          ) : (
            p.kind === "venue" && (
              <span className="flex items-center gap-1 text-muted">
                <Clock className="size-3.5" /> Horario no disponible
              </span>
            )
          )}
        </div>

        {p.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.genres.slice(0, 4).map((g) => (
              <span key={g} className="rounded-full border border-line-strong px-2.5 py-1 text-[12px] font-semibold text-muted">
                {genreName(g)}
              </span>
            ))}
          </div>
        )}

        {next ? (
          <Link href={`/events/${next.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2">
            <span className="relative shrink-0">
              <Cover imageKey={next.coverKey ?? p.coverKey} art={next.category} alt="" sizes="64px" className="size-14 rounded-xl" />
              {liveNow && <LiveDot className="absolute top-1 right-1" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold tracking-wider text-faint uppercase">{liveNow ? "Ahora" : p.kind === "venue" ? "Próximo evento" : "Cuándo"}</span>
              <span className="block truncate text-[14px] font-semibold">{p.kind === "venue" ? next.title : `${formatRelativeDay(next.startsAt, p.timezone)} · ${formatEventTime(next.startsAt, p.timezone, next.timeUnknown)}`}</span>
              <span className="block truncate text-[12px] text-muted">
                {p.kind === "venue" && `${formatRelativeDay(next.startsAt, p.timezone)} ${formatEventTime(next.startsAt, p.timezone, next.timeUnknown)} · `}
                {formatPrice(next.priceMin, next.priceMax, p.currency)}
              </span>
            </span>
          </Link>
        ) : (
          p.kind === "venue" && <p className="text-[13px] text-muted">Sin eventos anunciados{p.address ? ` · ${p.address}` : ""}</p>
        )}

        {tickets && (
          <a href={tickets.href} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass(tickets.buy ? "primary" : "secondary", "lg", "w-full")}>
            <Ticket className="size-4" /> {tickets.buy ? "Comprar entradas" : "Entradas e info oficial"}
          </a>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Link href={href} className={buttonClass(tickets?.buy ? "secondary" : "primary", "md", "col-span-3 sm:col-span-1")}>
            {p.kind === "venue" ? "Ver perfil" : "Ver evento"} <ArrowRight className="size-4" />
          </Link>
          <a href={directionsUrl({ lat: p.lat, lng: p.lng, name: p.name }, ua)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md", "col-span-3 min-[380px]:col-span-2 sm:col-span-1 sm:px-3")}>
            <Navigation className="size-4" /> Cómo llegar
          </a>
          <Link href={p.kind === "venue" ? `/venues/${p.slug}#eventos` : `/discover`} className={buttonClass("secondary", "md", "col-span-3 min-[380px]:col-span-1 sm:px-3")}>
            {p.kind === "venue" ? "Eventos" : "Más planes"}
          </Link>
        </div>
        {p.attribution && <p className="text-[11px] text-faint">Datos del local: {p.attribution}</p>}
      </div>
    </div>
  );
}

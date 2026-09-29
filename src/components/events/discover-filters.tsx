"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, LocateFixed, X } from "lucide-react";
import { Chip } from "@/components/ui/misc";
import { useLocation } from "@/components/providers/location-provider";
import { RADIUS_OPTIONS } from "@/lib/discover-params";
import { cn } from "@/lib/cn";

export const WHEN_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "tomorrow", label: "Mañana" },
  { value: "weekend", label: "Este finde" },
  { value: "week", label: "Esta semana" },
] as const;

export const PRICE_OPTIONS = [
  { value: "free", label: "Gratis" },
  { value: "10", label: "< 10 €" },
  { value: "20", label: "< 20 €" },
  { value: "30", label: "< 30 €" },
] as const;

export interface FilterOptions {
  categories: Array<{ slug: string; name: string }>;
  genres: Array<{ slug: string; name: string }>;
  venues: Array<{ id: string; name: string }>;
}

function Row({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label={label}>
      {children}
    </div>
  );
}

const selectClass = "h-9 shrink-0 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-semibold text-fg outline-none focus:border-fg";

/** URL-driven filters: every change is a shareable, server-rendered URL. */
export function DiscoverFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { coords, status, request } = useLocation();
  const near = params.get("near") === "1";

  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const toggle = (key: string, value: string) => update((p) => (p.get(key) === value ? p.delete(key) : p.set(key, value)));
  const setOrDelete = (key: string, value: string) => update((p) => (value ? p.set(key, value) : p.delete(key)));

  // Once location is granted, push coordinates into the URL for "near me".
  useEffect(() => {
    if (near && coords && (params.get("lat") !== coords.lat.toFixed(4) || params.get("lng") !== coords.lng.toFixed(4))) {
      update((p) => {
        p.set("lat", coords.lat.toFixed(4));
        p.set("lng", coords.lng.toFixed(4));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, coords]);

  const toggleNear = () => {
    if (near) {
      update((p) => ["near", "lat", "lng", "radius"].forEach((k) => p.delete(k)));
      return;
    }
    if (!coords) request();
    update((p) => p.set("near", "1"));
  };

  const active = ["when", "date", "price", "category", "genre", "venue", "near"].some((k) => params.has(k));
  const date = params.get("date") ?? "";

  return (
    <div className="space-y-2.5">
      <Row label="Cuándo">
        {WHEN_OPTIONS.map((o) => (
          <Chip key={o.value} active={!date && params.get("when") === o.value} onClick={() => update((p) => (p.delete("date"), p.get("when") === o.value ? p.delete("when") : p.set("when", o.value)))}>
            {o.label}
          </Chip>
        ))}
        <label className={cn(selectClass, "flex items-center gap-1.5", date && "border-volt")}>
          <CalendarDays className="size-3.5 text-muted" />
          <span className="sr-only">Fecha</span>
          <input type="date" value={date} onChange={(e) => update((p) => (p.delete("when"), e.target.value ? p.set("date", e.target.value) : p.delete("date")))} className="bg-transparent text-[13px] outline-none [color-scheme:dark]" />
        </label>
      </Row>
      <Row label="Precio y distancia">
        {PRICE_OPTIONS.map((o) => (
          <Chip key={o.value} active={params.get("price") === o.value} onClick={() => toggle("price", o.value)}>
            {o.label}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line-strong" />
        <Chip active={near} onClick={toggleNear}>
          <LocateFixed className={cn("size-3.5", status === "locating" && "animate-spin")} /> Cerca de mí
        </Chip>
        {near && (
          <select aria-label="Distancia máxima" value={params.get("radius") ?? "5"} onChange={(e) => setOrDelete("radius", e.target.value)} className={selectClass}>
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                ≤ {r} km
              </option>
            ))}
          </select>
        )}
      </Row>
      <Row label="Tipo, música y local">
        <select aria-label="Categoría" value={params.get("category") ?? ""} onChange={(e) => setOrDelete("category", e.target.value)} className={cn(selectClass, params.get("category") && "border-volt")}>
          <option value="">Todas las categorías</option>
          {options.categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select aria-label="Música" value={params.get("genre") ?? ""} onChange={(e) => setOrDelete("genre", e.target.value)} className={cn(selectClass, params.get("genre") && "border-volt")}>
          <option value="">Toda la música</option>
          {options.genres.map((g) => (
            <option key={g.slug} value={g.slug}>{g.name}</option>
          ))}
        </select>
        {options.venues.length > 0 && (
          <select aria-label="Local" value={params.get("venue") ?? ""} onChange={(e) => setOrDelete("venue", e.target.value)} className={cn(selectClass, "max-w-56", params.get("venue") && "border-volt")}>
            <option value="">Todos los locales</option>
            {options.venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
        {active && (
          <button onClick={() => router.replace(pathname, { scroll: false })} className="pressable ml-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-muted hover:text-fg">
            <X className="size-3.5" /> Limpiar
          </button>
        )}
      </Row>
      {near && status === "denied" && <p className="text-[13px] text-warn">No tenemos permiso para usar tu ubicación. Actívalo en el navegador o elige tu ciudad.</p>}
    </div>
  );
}

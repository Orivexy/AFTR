"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, X } from "lucide-react";
import { Chip } from "@/components/ui/misc";
import { useLocation } from "@/components/providers/location-provider";
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
] as const;

export const CATEGORY_OPTIONS = [
  { value: "fm", label: "FM" },
  { value: "discoteca", label: "Discotecas" },
  { value: "fiesta", label: "Fiestas" },
  { value: "dj", label: "DJ" },
  { value: "concierto", label: "Conciertos" },
] as const;

export const GENRE_OPTIONS = [
  { value: "techno", label: "Techno" },
  { value: "reggaeton", label: "Reggaeton" },
  { value: "house", label: "House" },
  { value: "hip-hop", label: "Hip Hop" },
  { value: "comercial", label: "Comercial" },
  { value: "electronica", label: "Electrónica" },
  { value: "latin", label: "Latin" },
] as const;

/** URL-driven filter chips: every change is a shareable, server-rendered URL. */
export function DiscoverFilters() {
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
  const toggle = (key: string, value: string) =>
    update((p) => (p.get(key) === value ? p.delete(key) : p.set(key, value)));

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
      update((p) => {
        p.delete("near");
        p.delete("lat");
        p.delete("lng");
      });
      return;
    }
    if (!coords) request();
    update((p) => p.set("near", "1"));
  };

  const active = ["when", "price", "category", "genre", "near"].some((k) => params.has(k));

  const Row = ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label={label}>
      {children}
    </div>
  );

  return (
    <div className="space-y-2.5">
      <Row label="Cuándo y precio">
        {WHEN_OPTIONS.map((o) => (
          <Chip key={o.value} active={params.get("when") === o.value} onClick={() => toggle("when", o.value)}>
            {o.label}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line-strong" />
        {PRICE_OPTIONS.map((o) => (
          <Chip key={o.value} active={params.get("price") === o.value} onClick={() => toggle("price", o.value)}>
            {o.label}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line-strong" />
        <Chip active={near} onClick={toggleNear}>
          <LocateFixed className={cn("size-3.5", status === "locating" && "animate-spin")} /> Cerca de mí
        </Chip>
      </Row>
      <Row label="Tipo y música">
        {CATEGORY_OPTIONS.map((o) => (
          <Chip key={o.value} active={params.get("category") === o.value} onClick={() => toggle("category", o.value)}>
            {o.label}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line-strong" />
        {GENRE_OPTIONS.map((o) => (
          <Chip key={o.value} active={params.get("genre") === o.value} onClick={() => toggle("genre", o.value)}>
            {o.label}
          </Chip>
        ))}
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

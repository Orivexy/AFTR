"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useLocation } from "@/components/providers/location-provider";
import { useToast } from "@/components/providers/toast-provider";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";

export interface CityOption {
  slug: string;
  name: string;
}

export function CityPicker({ cities, current, className }: { cities: CityOption[]; current: CityOption; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const { status, request, clear } = useLocation();

  const choose = (slug: string) => {
    start(async () => {
      try {
        await api.post("/api/city", { slug });
        setOpen(false);
        router.refresh();
      } catch {
        toast("No se pudo cambiar de ciudad", "error");
      }
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={cn("pressable inline-flex items-center gap-1.5 rounded-full py-1.5 text-sm font-semibold", className)}>
        {status === "granted" ? <LocateFixed className="size-4 text-volt" /> : <MapPin className="size-4 text-volt" />}
        {current.name}
        <ChevronDown className="size-4 text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="¿Dónde sales?">
        <div className="space-y-4 pb-2">
          <button
            onClick={() => (status === "granted" ? clear() : request())}
            className="pressable flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-left"
          >
            <LocateFixed className={cn("size-5", status === "granted" ? "text-volt" : "text-muted")} />
            <span className="flex-1">
              <span className="block font-semibold">
                {status === "granted" ? "Usando tu ubicación" : status === "locating" ? "Buscando tu ubicación…" : "Usar mi ubicación"}
              </span>
              <span className="block text-[13px] text-muted">
                {status === "denied"
                  ? "Permiso denegado. Puedes activarlo en los ajustes del navegador."
                  : status === "granted"
                    ? "Verás distancias y lo que hay cerca. Toca para dejar de usarla."
                    : "Solo se usa en tu dispositivo para calcular distancias."}
              </span>
            </span>
          </button>
          <div className="grid gap-1">
            {cities.map((c) => (
              <button
                key={c.slug}
                disabled={pending}
                onClick={() => choose(c.slug)}
                className="pressable flex items-center justify-between rounded-xl px-3 py-3 text-left font-medium hover:bg-surface-2"
              >
                {c.name}
                {c.slug === current.slug && <Check className="size-4 text-volt" />}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}

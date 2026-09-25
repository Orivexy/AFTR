"use client";

import { useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

export interface PickerOption {
  id: string;
  title: string;
  subtitle?: string;
}

/**
 * Generic searchable picker in a sheet. `load(query)` returns options; used
 * for tagging events, venues and people.
 */
export function EntityPicker({ label, placeholder, value, onChange, load, icon }: {
  label: string;
  placeholder: string;
  value: PickerOption | null;
  onChange: (v: PickerOption | null) => void;
  load: (q: string) => Promise<PickerOption[]>;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      load(q)
        .then((o) => !cancelled && setOptions(o))
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, load]);

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-surface-2 px-4 py-3">
        <span className="text-muted">{icon}</span>
        <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
          <span className="block text-[12px] font-semibold text-muted">{label}</span>
          <span className={cn("block truncate text-[15px]", !value && "text-faint")}>{value?.title ?? placeholder}</span>
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} aria-label={`Quitar ${label.toLowerCase()}`} className="grid size-8 place-items-center rounded-full hover:bg-surface-3">
            <X className="size-4" />
          </button>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} tall>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-12 w-full rounded-full border border-line-strong bg-surface-2 pr-4 pl-11 outline-none focus:border-volt/60" />
          </div>
          <div className="divide-y divide-line">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.title}</span>
                  {o.subtitle && <span className="block truncate text-[13px] text-muted">{o.subtitle}</span>}
                </span>
                {value?.id === o.id && <Check className="size-4 text-volt" />}
              </button>
            ))}
            {!loading && !options.length && <p className="py-8 text-center text-sm text-muted">Sin resultados</p>}
          </div>
        </div>
      </Sheet>
    </>
  );
}

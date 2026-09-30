import Link from "next/link";
import { Search } from "lucide-react";
import { NIGHTLIFE_FILTERS } from "@/lib/nightlife";
import { cn } from "@/lib/cn";

/**
 * Filters of the nightlife section: kind (Todos, Discotecas, Clubs,
 * Conciertos, Fiestas, Festivales, Eventos), zone and search by name.
 * Plain links and a GET form: works without JavaScript.
 */
export function NightlifeFilters({
  basePath,
  filter,
  zone,
  q,
  zones,
  keep = {},
}: {
  basePath: string;
  filter: string;
  zone?: string;
  q?: string;
  zones: string[];
  /** Other query parameters to keep (e.g. when=weekend). */
  keep?: Record<string, string | undefined>;
}) {
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, tipo: filter, zona: zone, q, ...over })) if (v && !(k === "tipo" && v === "todos")) p.set(k, v);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="space-y-3">
      <form action={basePath} method="get" role="search" className="flex flex-wrap gap-2">
        {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        {filter !== "todos" && <input type="hidden" name="tipo" value={filter} />}
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 focus-within:border-fg/50">
          <Search className="size-4 shrink-0 text-muted" />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre…" aria-label="Buscar por nombre" maxLength={80} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </label>
        <select name="zona" defaultValue={zone ?? ""} aria-label="Zona" className="h-10 rounded-full border border-line-strong bg-surface px-4 text-[14px]">
          <option value="">Todas las zonas</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-full bg-fg px-5 text-[14px] font-semibold text-ink">
          Buscar
        </button>
      </form>
      <nav aria-label="Tipo" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {NIGHTLIFE_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href({ tipo: f.value })}
            scroll={false}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn("pressable h-9 shrink-0 rounded-full px-4 text-[13px] leading-9 font-semibold", filter === f.value ? "bg-fg text-ink" : "border border-line-strong hover:bg-surface-2")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { useLocation } from "@/components/providers/location-provider";

/**
 * Debounced search input that keeps the query in the URL (?q=). Queries
 * like "cerca de mí" ask for the location (once, via the browser prompt)
 * and pass approximate coordinates along.
 */
export function SearchBox({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const first = useRef(true);
  const { coords, status, request } = useLocation();
  const near = /\b(cerca|near)\b/i.test(q);

  useEffect(() => {
    if (near && !coords && status === "idle") request();
  }, [near, coords, status, request]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!(near && coords)) return;
    }
    setPending(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      // ~100 m precision is enough for "near me".
      if (q.trim() && near && coords) {
        params.set("lat", coords.lat.toFixed(3));
        params.set("lng", coords.lng.toFixed(3));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setPending(false);
    }, 280);
    return () => clearTimeout(t);
  }, [q, pathname, router, near, coords]);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
      <input
        autoFocus
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={100}
        placeholder="Busca “Gràcia”, “techno”, una discoteca o a alguien"
        aria-label="Buscar"
        className="h-13 w-full rounded-full border border-line-strong bg-surface pr-12 pl-12 text-[16px] outline-none focus:border-volt/60 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute top-1/2 right-4 -translate-y-1/2">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted" />
        ) : (
          q && (
            <button onClick={() => setQ("")} aria-label="Borrar búsqueda" className="grid size-6 place-items-center rounded-full bg-surface-3">
              <X className="size-3.5" />
            </button>
          )
        )}
      </span>
    </div>
  );
}

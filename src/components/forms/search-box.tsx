"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

/** Debounced search input that keeps the query in the URL (?q=). */
export function SearchBox({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPending(true);
    const t = setTimeout(() => {
      router.replace(q.trim() ? `${pathname}?q=${encodeURIComponent(q.trim())}` : pathname, { scroll: false });
      setPending(false);
    }, 280);
    return () => clearTimeout(t);
  }, [q, pathname, router]);

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

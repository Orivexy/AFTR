"use client";

import { Loader2 } from "lucide-react";
import { useInfinite } from "@/hooks/use-infinite";
import { EventCard, EventRow } from "./event-card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import type { EventCardData, Page } from "@/lib/types";

/** Infinite list of events backed by /api/events (or any Page endpoint). */
export function EventList({ initial, endpoint, layout = "grid", emptyTitle = "No hay eventos con estos filtros", emptyText }: { initial: Page<EventCardData>; endpoint: string; layout?: "grid" | "rows"; emptyTitle?: string; emptyText?: string }) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const { items, hasMore, loading, error, loadMore, sentinel } = useInfinite(initial, (cursor) => `${endpoint}${sep}cursor=${cursor}`);

  if (!items.length) return <EmptyState title={emptyTitle}>{emptyText ?? "Prueba con otras fechas o quita algún filtro."}</EmptyState>;
  return (
    <>
      {layout === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e, i) => <EventCard key={e.id} event={e} priority={i < 2} />)}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((e) => (
            <div key={e.id} className="py-1">
              <EventRow event={e} showDay />
            </div>
          ))}
        </div>
      )}
      <div ref={sentinel} className="flex justify-center py-6">
        {loading && <Loader2 className="size-5 animate-spin text-muted" />}
        {error && <Button variant="secondary" size="sm" onClick={loadMore}>Reintentar</Button>}
        {!hasMore && items.length > 6 && <p className="text-sm text-faint">Eso es todo por ahora ✨</p>}
      </div>
    </>
  );
}

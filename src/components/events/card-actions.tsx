"use client";

import { Bookmark, Share2 } from "lucide-react";
import { useSavedEvents } from "@/components/providers/saved-events-provider";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { useToast } from "@/components/providers/toast-provider";
import { shareLink } from "@/components/social/share-button";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/** Save + share buttons on event cards (sit above the card's stretched link). */
export function CardActions({ eventId, slug, title, className }: { eventId: string; slug: string; title: string; className?: string }) {
  const { isSaved, setSaved } = useSavedEvents();
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const saved = isSaved(eventId);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireAuth("Inicia sesión para guardar eventos")) return;
    setSaved(eventId, !saved);
    try {
      await api.put(`/api/events/${eventId}/save`, { saved: !saved });
      toast(!saved ? "Guardado en tus planes" : "Eliminado de guardados", "info");
    } catch (err) {
      setSaved(eventId, saved);
      toast((err as ApiClientError).message, "error");
    }
  };

  const share = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void shareLink(`/events/${slug}`, title, toast);
  };

  const btn = "pressable glass grid size-9 place-items-center rounded-full border border-line text-fg";
  return (
    <div className={cn("relative flex gap-1.5", className)}>
      <button onClick={toggle} aria-pressed={saved} aria-label={saved ? "Quitar de guardados" : "Guardar evento"} className={btn}>
        <Bookmark className={cn("size-4", saved && "text-volt")} fill={saved ? "currentColor" : "none"} />
      </button>
      <button onClick={share} aria-label="Compartir evento" className={btn}>
        <Share2 className="size-4" />
      </button>
    </div>
  );
}

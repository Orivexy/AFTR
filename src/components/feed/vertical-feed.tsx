"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { FeedItem } from "./feed-item";
import { useSession } from "@/components/providers/session-provider";
import { api, reviveDates } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { FeedPost, Page } from "@/lib/types";

type Mode = "foryou" | "following";

/**
 * Full-screen vertical feed. Scroll-snap does the paging; an
 * IntersectionObserver decides which item is "active" (plays video). Only
 * items within ±2 of the active one mount <video> elements.
 */
export function VerticalFeed({ initial, mode, pinned }: { initial: Page<FeedPost>; mode: Mode; pinned?: FeedPost | null }) {
  const [items, setItems] = useState<FeedPost[]>(() => (pinned ? [pinned, ...initial.items.filter((p) => p.id !== pinned.id)] : initial.items));
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const user = useSession();
  const router = useRouter();

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = reviveDates(await api.get<Page<FeedPost>>(`/api/feed?mode=${mode}&cursor=${cursor}`));
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, mode]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // Track the item that fills most of the viewport; prefetch near the end.
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const index = Number((e.target as HTMLElement).dataset.index);
          setActive(index);
          if (index >= items.length - 3) void loadMoreRef.current();
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  // Keyboard navigation on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const root = container.current;
      if (!root) return;
      if (e.key === "ArrowDown" || e.key === "j") root.scrollBy({ top: root.clientHeight, behavior: "smooth" });
      if (e.key === "ArrowUp" || e.key === "k") root.scrollBy({ top: -root.clientHeight, behavior: "smooth" });
      if (e.key === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = (p: FeedPost) => setItems((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="feed-viewport fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-black md:relative md:h-[calc(100dvh-4rem)] md:bg-ink">
      {/* Tabs */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3 md:pt-7">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/30 p-1 backdrop-blur-md">
          {(["foryou", "following"] as const).map((m) => (
            <button
              key={m}
              onClick={() => router.replace(m === "foryou" ? "/social" : "/social?tab=following")}
              className={cn("rounded-full px-4 py-1.5 text-sm font-bold transition-colors", mode === m ? "bg-white text-black" : "text-white/75 hover:text-white")}
            >
              {m === "foryou" ? "Para ti" : "Siguiendo"}
            </button>
          ))}
        </div>
      </div>

      <div ref={container} className="scrollbar-none snap-feed size-full overflow-y-auto md:py-4">
        {items.map((post, i) => (
          <div key={post.id} data-index={i} className="relative h-full snap-start snap-always md:mx-auto md:mb-4 md:aspect-[9/16] md:h-[calc(100%-1rem)]">
            <FeedItem
              post={post}
              active={i === active}
              nearby={Math.abs(i - active) <= 2}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onChange={update}
              onRemove={remove}
            />
          </div>
        ))}
        {loading && (
          <div className="grid h-24 place-items-center">
            <Loader2 className="size-6 animate-spin text-white/60" />
          </div>
        )}
        {!items.length && (
          <div className="grid h-full place-items-center px-8 text-center">
            <div className="space-y-4">
              <Sparkles className="mx-auto size-8 text-volt" />
              <p className="font-display text-xl font-semibold">{mode === "following" ? "Aún no sigues a nadie" : "No hay publicaciones todavía"}</p>
              <p className="text-muted">{mode === "following" ? (user ? "Sigue a gente y locales para ver aquí lo que publican." : "Inicia sesión para ver lo que publica la gente que sigues.") : "Sé el primero en compartir la noche."}</p>
              <Link href={mode === "following" ? "/people" : "/create/post?type=photo"} className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-volt px-5 font-semibold text-on-volt">
                <Plus className="size-4" /> {mode === "following" ? "Descubrir gente" : "Publicar"}
              </Link>
            </div>
          </div>
        )}
        {!cursor && items.length > 0 && !loading && (
          <div className="grid h-40 snap-start place-items-center text-sm text-white/50">Has llegado al final · vuelve más tarde ✨</div>
        )}
      </div>
    </div>
  );
}

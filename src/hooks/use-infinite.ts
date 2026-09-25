"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, reviveDates } from "@/lib/api-client";
import type { Page } from "@/lib/types";

/**
 * Cursor pagination + an IntersectionObserver sentinel. `buildUrl` gets the
 * cursor and returns the API URL for the next page.
 */
export function useInfinite<T extends { id: string }>(initial: Page<T>, buildUrl: (cursor: string) => string) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const build = useRef(buildUrl);
  build.current = buildUrl;

  useEffect(() => {
    setItems(initial.items);
    setCursor(initial.nextCursor);
  }, [initial]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const page = reviveDates(await api.get<Page<T>>(build.current(cursor)));
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return { items, setItems, hasMore: Boolean(cursor), loading, error, loadMore, sentinel };
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "./session-provider";
import { api } from "@/lib/api-client";

interface SavedEvents {
  isSaved: (id: string) => boolean;
  setSaved: (id: string, saved: boolean) => void;
}

const Ctx = createContext<SavedEvents>({ isSaved: () => false, setSaved: () => {} });

/** Loads the viewer's saved event ids once per session so cards can show a bookmark state. */
export function SavedEventsProvider({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ ids: string[] }>("/api/me/saved/ids")
      .then((r) => !cancelled && setIds(new Set(r.ids)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isSaved = useCallback((id: string) => ids.has(id), [ids]);
  const setSaved = useCallback((id: string, saved: boolean) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ isSaved, setSaved }}>{children}</Ctx.Provider>;
}

export const useSavedEvents = () => useContext(Ctx);

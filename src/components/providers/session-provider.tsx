"use client";

import { createContext, useContext } from "react";
import type { AppRole } from "@/lib/roles";

export interface ClientUser {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  role: AppRole;
}

const SessionContext = createContext<ClientUser | null>(null);

export function SessionProvider({ user, children }: { user: ClientUser | null; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

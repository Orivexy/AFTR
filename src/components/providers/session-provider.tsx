"use client";

import { createContext, useContext } from "react";

export interface ClientUser {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
}

const SessionContext = createContext<ClientUser | null>(null);

export function SessionProvider({ user, children }: { user: ClientUser | null; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

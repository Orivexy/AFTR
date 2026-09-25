"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { useSession } from "./session-provider";
import { site } from "@/config/site";

/**
 * `requireAuth()` returns true when signed in; otherwise it opens a sheet
 * inviting the visitor to log in (and come back to the same page).
 */
const AuthGateContext = createContext<(reason?: string) => boolean>(() => false);

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const pathname = usePathname();
  const [reason, setReason] = useState<string | null>(null);

  const requireAuth = useCallback(
    (why?: string) => {
      if (user) return true;
      setReason(why ?? "Únete para interactuar con la comunidad");
      return false;
    },
    [user],
  );

  const next = encodeURIComponent(pathname || "/");
  return (
    <AuthGateContext.Provider value={requireAuth}>
      {children}
      <Sheet open={reason !== null} onClose={() => setReason(null)} title="Entra en la noche">
        <div className="space-y-5 pb-2">
          <p className="text-muted">{reason}</p>
          <div className="grid gap-2.5">
            <Link href={`/register?next=${next}`} onClick={() => setReason(null)} className="pressable flex h-12 items-center justify-center rounded-full bg-volt font-semibold text-on-volt">
              Crear cuenta en {site.name}
            </Link>
            <Link href={`/login?next=${next}`} onClick={() => setReason(null)} className="pressable flex h-12 items-center justify-center rounded-full border border-line-strong font-semibold">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </Sheet>
    </AuthGateContext.Provider>
  );
}

export function useRequireAuth() {
  return useContext(AuthGateContext);
}

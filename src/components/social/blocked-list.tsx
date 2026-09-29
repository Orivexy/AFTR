"use client";

import { useState } from "react";
import { UserRow } from "./user-row";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { api } from "@/lib/api-client";
import type { UserMini } from "@/lib/types";

export function BlockedList({ initial }: { initial: UserMini[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const unblock = async (id: string) => {
    setBusy(id);
    try {
      await api.put(`/api/users/${id}/block`, { blocked: false });
      setItems((list) => list.filter((u) => u.id !== id));
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) return <p className="text-sm text-muted">No has bloqueado a nadie.</p>;
  return (
    <div className="divide-y divide-line">
      {items.map((u) => (
        <div key={u.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <UserRow user={u} showFollow={false} />
          </div>
          <Button size="sm" variant="secondary" loading={busy === u.id} onClick={() => unblock(u.id)}>
            Desbloquear
          </Button>
        </div>
      ))}
    </div>
  );
}

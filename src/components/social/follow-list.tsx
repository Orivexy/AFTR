"use client";

import { Loader2 } from "lucide-react";
import { useInfinite } from "@/hooks/use-infinite";
import { useSession } from "@/components/providers/session-provider";
import { EmptyState } from "@/components/ui/misc";
import { UserRow } from "./user-row";
import type { Page, UserMini } from "@/lib/types";

export function FollowList({ initial, url, empty }: { initial: Page<UserMini & { viewerFollows: boolean }>; url: string; empty: string }) {
  const me = useSession();
  const { items, sentinel, loading } = useInfinite(initial, (c) => `${url}?cursor=${c}`);
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <div className="divide-y divide-line">
      {items.map((u) => <UserRow key={u.id} user={u} following={u.viewerFollows} showFollow={me?.id !== u.id} />)}
      <div ref={sentinel} className="flex justify-center py-4">{loading && <Loader2 className="size-5 animate-spin text-muted" />}</div>
    </div>
  );
}

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "./follow-button";
import { compactNumber } from "@/lib/text";

export function UserRow({ user, following, showFollow = true, subtitle }: { user: { id: string; username: string; displayName: string; avatarKey: string | null; followerCount?: number; bio?: string | null }; following?: boolean; showFollow?: boolean; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar user={user} size={46} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.displayName}</p>
          <p className="truncate text-[13px] text-muted">
            @{user.username}
            {subtitle ? ` · ${subtitle}` : user.followerCount != null ? ` · ${compactNumber(user.followerCount)} seguidores` : ""}
          </p>
        </div>
      </Link>
      {showFollow && <FollowButton targetId={user.id} initial={Boolean(following)} size="sm" />}
    </div>
  );
}

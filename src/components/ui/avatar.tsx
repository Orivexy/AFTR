import Image from "next/image";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/media";
import { initials } from "@/lib/text";

interface AvatarProps {
  user: { displayName: string; avatarKey: string | null };
  size?: number;
  className?: string;
  ring?: boolean;
}

export function Avatar({ user, size = 40, className, ring }: AvatarProps) {
  const src = imageUrl(user.avatarKey, "sm");
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-semibold text-muted",
        ring && "ring-2 ring-ink",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {src ? <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" /> : initials(user.displayName)}
    </span>
  );
}

export function AvatarStack({ users, size = 26, max = 4 }: { users: Array<{ id: string; displayName: string; avatarKey: string | null }>; size?: number; max?: number }) {
  return (
    <span className="flex -space-x-2">
      {users.slice(0, max).map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
    </span>
  );
}

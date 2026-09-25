import Link from "next/link";
import Image from "next/image";
import { Heart, Layers, Play } from "lucide-react";
import { imageUrl } from "@/lib/media";
import { compactNumber } from "@/lib/text";
import { cn } from "@/lib/cn";
import type { FeedPost } from "@/lib/types";

/** Thumbnail grid of posts; tapping opens the vertical feed at that post. */
export function PostGrid({ posts, className, source }: { posts: FeedPost[]; className?: string; source?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-1 md:gap-2", className)}>
      {posts.map((p) => {
        const key = p.video?.posterKey ?? p.photos[0]?.key ?? null;
        const src = imageUrl(key, "sm");
        return (
          <Link
            key={p.id}
            href={`/social?post=${p.id}${source ? `&from=${source}` : ""}`}
            className="group pressable relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-2 md:rounded-xl"
          >
            {src && <Image src={src} alt={p.caption ?? ""} fill sizes="(min-width: 768px) 240px, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <span className="absolute top-2 right-2 text-white drop-shadow">
              {p.type === "VIDEO" ? <Play className="size-4" fill="currentColor" /> : p.type === "CAROUSEL" ? <Layers className="size-4" /> : null}
            </span>
            <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[12px] font-bold text-white drop-shadow">
              <Heart className="size-3.5" fill="currentColor" /> {compactNumber(p.likeCount)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

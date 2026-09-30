import Image from "next/image";
import { Disc3, Headphones, Mic2, PartyPopper, Sparkles, Tent, Music } from "lucide-react";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/media";

interface CoverProps {
  imageKey: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  blurDataUrl?: string | null;
  /** Category slug (fm, fiesta, concierto, dj, discoteca, festival) or "club": artwork when there is no photo. */
  art?: string | null;
}

/**
 * Artwork shown when the source published no photo: a designed cover per
 * category (clearly an illustration, never a stand-in "photo" of the place).
 */
const ART: Record<string, { from: string; via: string; to: string; Icon: typeof Disc3 }> = {
  fm: { from: "#ff7a18", via: "#c2185b", to: "#2a0f3d", Icon: Tent },
  fiesta: { from: "#ff4fd8", via: "#7b2ff7", to: "#140a2e", Icon: PartyPopper },
  concierto: { from: "#00c6ff", via: "#3a2a9e", to: "#0b0b1e", Icon: Mic2 },
  dj: { from: "#d7ff3a", via: "#1f8a70", to: "#07130f", Icon: Headphones },
  discoteca: { from: "#8a5cff", via: "#2b1b6b", to: "#09071a", Icon: Disc3 },
  club: { from: "#8a5cff", via: "#2b1b6b", to: "#09071a", Icon: Disc3 },
  festival: { from: "#ffd166", via: "#ef476f", to: "#1b0b25", Icon: Sparkles },
};
const DEFAULT_ART = { from: "#3a2a6e", via: "#1f4d5a", to: "#0c0c12", Icon: Music };

export function Cover({ imageKey, alt, sizes, priority, className, blurDataUrl, art }: CoverProps) {
  const src = imageUrl(imageKey, "lg");
  const a = (art && ART[art]) || DEFAULT_ART;
  return (
    <div className={cn("@container relative overflow-hidden bg-surface-2", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={blurDataUrl ? "blur" : "empty"}
          blurDataURL={blurDataUrl ?? undefined}
          className="object-cover"
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 15% 10%, ${a.from} 0%, transparent 55%), radial-gradient(110% 100% at 90% 90%, ${a.via} 0%, transparent 60%), ${a.to}` }}>
          <div className="absolute inset-0 opacity-[0.18] [background:repeating-linear-gradient(115deg,rgb(255_255_255/0.5)_0_1px,transparent_1px_14px)]" />
          <a.Icon className="absolute right-[6%] bottom-[8%] size-[38%] max-h-[70%] text-white/25" strokeWidth={1.2} />
        </div>
      )}
    </div>
  );
}

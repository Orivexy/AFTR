import Image from "next/image";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/media";

interface CoverProps {
  imageKey: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  blurDataUrl?: string | null;
}

/** Image with a branded gradient fallback when there's no picture. */
export function Cover({ imageKey, alt, sizes, priority, className, blurDataUrl }: CoverProps) {
  const src = imageUrl(imageKey, "lg");
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#3a2a6e_0%,transparent_55%),radial-gradient(circle_at_80%_70%,#1f4d5a_0%,transparent_50%)]" />
      )}
    </div>
  );
}

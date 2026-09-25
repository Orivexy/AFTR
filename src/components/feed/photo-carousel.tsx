"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { imageUrl } from "@/lib/media";
import { cn } from "@/lib/cn";
import type { PhotoData } from "@/lib/types";

export function PhotoCarousel({ photos, priority, onDoubleTap }: { photos: PhotoData[]; priority?: boolean; onDoubleTap: () => void }) {
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleTap();
    lastTap.current = now;
  };
  return (
    <div className="absolute inset-0 bg-black" onClick={onTap}>
      <div className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto" onScroll={onScroll}>
        {photos.map((p, i) => (
          <div key={p.id} className="relative size-full shrink-0 snap-center">
            {/* Blurred backdrop fills the frame for non-vertical photos */}
            {p.blurDataUrl && <Image src={p.blurDataUrl} alt="" fill className="scale-110 object-cover opacity-60 blur-2xl" unoptimized />}
            <Image
              src={imageUrl(p.key, "lg")!}
              alt=""
              fill
              sizes="(min-width: 768px) 480px, 100vw"
              className={p.height / p.width >= 1.2 ? "object-cover" : "object-contain"}
              priority={priority && i === 0}
              loading={priority && i === 0 ? undefined : "lazy"}
              placeholder={p.blurDataUrl ? "blur" : "empty"}
              blurDataURL={p.blurDataUrl ?? undefined}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center gap-1.5">
          {photos.map((p, i) => (
            <span key={p.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-white" : "w-1.5 bg-white/40")} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { imageUrl, videoUrl } from "@/lib/media";

interface Props {
  videoKey: string;
  posterKey: string | null;
  active: boolean;
  /** Mount the <video> element (only near the viewport, to save memory). */
  mounted: boolean;
  muted: boolean;
  onDoubleTap: () => void;
}

/**
 * Feed video: plays only while it's the active item, pauses otherwise,
 * preloads metadata only when close to the viewport, and shows the poster
 * until the first frame is ready.
 */
export function FeedVideo({ videoKey, posterKey, active, mounted, muted, onDoubleTap }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const poster = imageUrl(posterKey, "lg");

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.play()
        .then(() => setPaused(false))
        // Autoplay blocked (e.g. power saving): show the play button. AbortError just means we paused again.
        .catch((err: DOMException) => err.name === "NotAllowedError" && setPaused(true));
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [active, mounted]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      clearTimeout(tapTimer.current);
      onDoubleTap();
    } else {
      tapTimer.current = setTimeout(() => {
        const v = ref.current;
        if (!v) return;
        if (v.paused) void v.play().then(() => setPaused(false));
        else {
          v.pause();
          setPaused(true);
        }
      }, 280);
    }
    lastTap.current = now;
  };

  return (
    <div className="absolute inset-0 bg-black" onClick={onTap}>
      {poster && !ready && <Image src={poster} alt="" fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover" priority={active} />}
      {mounted && (
        <video
          ref={ref}
          src={videoUrl(videoKey)}
          poster={poster ?? undefined}
          className="absolute inset-0 size-full object-cover"
          playsInline
          loop
          muted={muted}
          preload={active ? "auto" : "metadata"}
          onLoadedData={() => setReady(true)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
          disablePictureInPicture
        />
      )}
      {paused && active && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="animate-pop grid size-16 place-items-center rounded-full bg-black/40 backdrop-blur">
            <Play className="size-7 translate-x-0.5" fill="currentColor" />
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
        <div className="h-full bg-white/80 transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

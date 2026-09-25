"use client";

import { useLocation } from "@/components/providers/location-provider";
import { distanceKm, formatDistance } from "@/lib/geo";

/** Distance from the user — only rendered when they shared their location. */
export function Distance({ lat, lng, prefix = "· ", className }: { lat: number; lng: number; prefix?: string; className?: string }) {
  const { coords } = useLocation();
  if (!coords) return null;
  return (
    <span className={className}>
      {prefix}
      {formatDistance(distanceKm(coords, { lat, lng }))}
    </span>
  );
}

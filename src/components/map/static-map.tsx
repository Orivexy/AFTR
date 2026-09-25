"use client";

import { MapView } from "./map-view";
import type { MapConfig } from "@/server/services/map";

/** Non-interactive map preview for detail pages. */
export function StaticMap({ config, lat, lng, variant, className }: { config: MapConfig; lat: number; lng: number; variant: string; className?: string }) {
  return (
    <div className={className}>
      <MapView config={config} center={{ lat, lng }} zoom={15} interactive={false} markers={[{ id: "here", lat, lng, variant }]} className="size-full" />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { MapCanvasProps } from "./map-canvas";

/** Client-only, lazily loaded map (Leaflet touches `window`). */
export const MapView = dynamic<MapCanvasProps>(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <div className="skeleton size-full" />,
});

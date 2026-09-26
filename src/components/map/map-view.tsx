"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { MapProviderProps } from "./types";

/**
 * MapProvider registry. Renderers are client-only and lazily loaded; pick
 * one with MapConfig.renderer. To add Mapbox GL or Google Maps, create
 * providers/<name>-map.tsx implementing MapProviderProps and register it here.
 */
const loading = () => <div className="skeleton size-full" />;

const RENDERERS: Record<string, ComponentType<MapProviderProps>> = {
  leaflet: dynamic<MapProviderProps>(() => import("./providers/leaflet-map"), { ssr: false, loading }),
};

export function MapView(props: MapProviderProps) {
  const Renderer = RENDERERS[props.config.renderer] ?? RENDERERS.leaflet!;
  return <Renderer {...props} />;
}

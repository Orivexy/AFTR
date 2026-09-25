"use client";

import { useEffect, useRef } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapConfig } from "@/server/services/map";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Visual style: venue, fm, fiesta, event… */
  variant: string;
  label?: string;
  live?: boolean;
}

export interface MapCanvasProps {
  config: MapConfig;
  center: { lat: number; lng: number };
  zoom?: number;
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Tap on empty map (used by the location picker). */
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  interactive?: boolean;
  user?: { lat: number; lng: number } | null;
  className?: string;
}

const EMOJI: Record<string, string> = { fm: "🎪", fiesta: "🎉", concierto: "🎤", dj: "🎧", otro: "✨" };

function markerHtml(m: MapMarker, selected: boolean) {
  const isVenue = m.variant === "venue";
  const glyph = isVenue ? "" : EMOJI[m.variant] ?? "🎉";
  const cls = [
    "nm-marker",
    isVenue ? "nm-venue" : "nm-event",
    selected ? "nm-selected" : "",
    m.live ? "nm-live" : "",
  ].join(" ");
  const label = selected && m.label ? `<span class="nm-label">${escapeHtml(m.label)}</span>` : "";
  return `<div class="${cls}"><span class="nm-dot">${glyph}</span>${label}</div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Leaflet implementation of the map canvas. The rest of the app only talks
 * to `MapCanvasProps`, so swapping to Mapbox GL / Google Maps means writing
 * another component with the same props.
 */
export default function MapCanvas({ config, center, zoom = 13, markers, selectedId, onSelect, onMapClick, interactive = true, user, className }: MapCanvasProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const userLayer = useRef<L.LayerGroup | null>(null);
  const leaflet = useRef<typeof L | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Init once
  useEffect(() => {
    let disposed = false;
    void import("leaflet").then((mod) => {
      const Lf = (mod.default ?? mod) as typeof L;
      if (disposed || !el.current || map.current) return;
      leaflet.current = Lf;
      const m = Lf.map(el.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: interactive,
        attributionControl: true,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        keyboard: interactive,
      });
      Lf.tileLayer(config.tileUrl, { attribution: config.attribution, maxZoom: config.maxZoom, subdomains: "abcd", detectRetina: true }).addTo(m);
      if (interactive) {
        m.on("click", (e: L.LeafletMouseEvent) => {
          if (onMapClickRef.current) onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
          else onSelectRef.current?.(null);
        });
      }
      layer.current = Lf.layerGroup().addTo(m);
      userLayer.current = Lf.layerGroup().addTo(m);
      map.current = m;
      renderMarkers();
      renderUser();
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMarkers() {
    const Lf = leaflet.current;
    if (!Lf || !layer.current) return;
    layer.current.clearLayers();
    for (const m of markers) {
      const selected = m.id === selectedId;
      const icon = Lf.divIcon({ html: markerHtml(m, selected), className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = Lf.marker([m.lat, m.lng], { icon, zIndexOffset: selected ? 1000 : m.variant === "venue" ? 0 : 100, keyboard: interactive, title: m.label });
      if (interactive) marker.on("click", (e) => {
        Lf.DomEvent.stopPropagation(e);
        onSelectRef.current?.(m.id);
      });
      marker.addTo(layer.current);
    }
  }

  function renderUser() {
    const Lf = leaflet.current;
    if (!Lf || !userLayer.current) return;
    userLayer.current.clearLayers();
    if (user) {
      Lf.marker([user.lat, user.lng], { icon: Lf.divIcon({ html: '<div class="nm-user"></div>', className: "", iconSize: [30, 30], iconAnchor: [15, 15] }), interactive: false }).addTo(userLayer.current);
    }
  }

  useEffect(renderMarkers, [markers, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(renderUser, [user]);

  useEffect(() => {
    map.current?.flyTo([center.lat, center.lng], Math.max(map.current.getZoom(), zoom), { duration: 0.6 });
  }, [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={className} role="application" aria-label="Mapa" />;
}

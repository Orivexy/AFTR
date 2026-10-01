"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type * as ML from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MarkerClusters } from "../clusters";
import { clusterHtml, isPlace, markerHtml } from "../marker-html";
import { nightStyle, satelliteVisibility, withSatellite, type StyleJson } from "../night-style";
import { BARCELONA_BOUNDS, MIN_ZOOM, type MapMarker, type MapProviderProps } from "../types";

/**
 * MapProvider: MapLibre GL renderer with vector tiles (OpenFreeMap, no key).
 * Smooth zoom, rotation, tilt and 3D buildings, in the style of Apple Maps.
 * Without WebGL, or if the style cannot load, it falls back to Leaflet.
 *
 * MapLibre zoom levels use 512 px tiles: zoom z here looks like z + 1 in
 * Leaflet, so the shared props (Leaflet scale) are shifted by one.
 */
const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false, loading: () => <div className="skeleton size-full" /> });
const GL_OFFSET = 1;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function MapLibreMap(props: MapProviderProps) {
  const [fallback, setFallback] = useState(false);
  if (fallback || !props.config.styleUrl) return <LeafletMap {...props} />;
  return <VectorMap {...props} onFail={() => setFallback(true)} />;
}

/** Apple-Maps-like 2D/3D toggle. */
class TiltControl implements ML.IControl {
  private el?: HTMLButtonElement;
  onAdd(map: ML.Map) {
    const wrap = document.createElement("div");
    wrap.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const b = (this.el = document.createElement("button"));
    b.type = "button";
    b.className = "nx-tilt";
    const sync = () => {
      b.textContent = map.getPitch() > 5 ? "2D" : "3D";
      b.setAttribute("aria-label", map.getPitch() > 5 ? "Vista 2D" : "Vista 3D");
    };
    b.onclick = () => (map.getPitch() > 5 ? map.easeTo({ pitch: 0, bearing: 0, duration: 700 }) : map.easeTo({ pitch: 60, zoom: Math.max(map.getZoom(), 15.5), duration: 900 }));
    map.on("pitchend", sync);
    sync();
    wrap.appendChild(b);
    return wrap;
  }
  onRemove() {
    this.el?.parentElement?.remove();
  }
}

function VectorMap({
  config, center, zoom = 13, markers, selectedId, onSelect, onMapClick, interactive = true, wheelZoom, cluster = false, zoomControls = false, user, recenterKey = 0, className, satellite = false, fitMarkers, onFail,
}: MapProviderProps & { onFail: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<ML.Map | null>(null);
  const lib = useRef<typeof ML | null>(null);
  const drawn = useRef<ML.Marker[]>([]);
  const userMarker = useRef<ML.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  const onFailRef = useRef(onFail);
  const styleRef = useRef<StyleJson | null>(null);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onMapClickRef.current = onMapClick;
    onFailRef.current = onFail;
  });

  const clusters = useMemo(() => (cluster ? new MarkerClusters(markers.filter((m) => m.id !== selectedId)) : null), [cluster, markers, selectedId]);
  const renderRef = useRef<() => void>(() => {});

  useEffect(() => {
    renderRef.current = () => {
      const gl = lib.current;
      const m = map.current;
      if (!gl || !m) return;
      for (const mk of drawn.current) mk.remove();
      drawn.current = [];

      const place = (lng: number, lat: number, html: string, size: number, z: number, title: string | undefined, onClick: (() => void) | null) => {
        const wrap = document.createElement("div");
        wrap.style.width = wrap.style.height = `${size}px`;
        wrap.style.zIndex = String(z);
        wrap.innerHTML = html;
        if (title) wrap.title = title;
        if (onClick && interactive) {
          wrap.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick();
          });
        }
        drawn.current.push(new gl.Marker({ element: wrap, anchor: "center" }).setLngLat([lng, lat]).addTo(m));
      };
      const addMarker = (mk: MapMarker) => {
        const selected = mk.id === selectedId;
        const pin = isPlace(mk.variant);
        place(mk.lng, mk.lat, markerHtml(mk, selected), pin ? 26 : 30, selected ? 1000 : mk.live ? 200 : pin ? 0 : 100, mk.label, () => onSelectRef.current?.(mk.id));
      };

      if (!clusters) {
        markers.forEach(addMarker);
        return;
      }
      const b = m.getBounds();
      const padLng = (b.getEast() - b.getWest()) * 0.3;
      const padLat = (b.getNorth() - b.getSouth()) * 0.3;
      for (const item of clusters.items([b.getWest() - padLng, b.getSouth() - padLat, b.getEast() + padLng, b.getNorth() + padLat], m.getZoom() + GL_OFFSET)) {
        if (item.type === "marker") {
          addMarker(item.marker);
          continue;
        }
        const { size, html } = clusterHtml(item.count, item.live);
        place(item.lng, item.lat, html, size, 500, `${item.count} lugares`, () =>
          m.flyTo({ center: [item.lng, item.lat], zoom: Math.min(clusters.expansionZoom(item.id), config.maxZoom) - GL_OFFSET, duration: 600 }),
        );
      }
      const sel = markers.find((x) => x.id === selectedId);
      if (sel) addMarker(sel);
    };
    renderRef.current();
  }, [clusters, markers, selectedId, interactive, config.maxZoom]);

  // Init once
  useEffect(() => {
    let disposed = false;
    if (!hasWebGL()) {
      onFailRef.current();
      return;
    }
    (async () => {
      try {
        const [mod, res] = await Promise.all([import("maplibre-gl"), fetch(config.styleUrl!)]);
        if (!res.ok) throw new Error(`style ${res.status}`);
        const night = nightStyle((await res.json()) as StyleJson);
        const style = config.satelliteUrl ? withSatellite(night, config.satelliteUrl, config.satelliteAttribution ?? "") : night;
        styleRef.current = style;
        const gl = ("default" in mod && mod.default ? mod.default : mod) as unknown as typeof ML;
        if (disposed || !el.current || map.current) return;
        lib.current = gl;
        const m = new gl.Map({
          container: el.current,
          style: style as unknown as ML.StyleSpecification,
          center: [center.lng, center.lat],
          zoom: zoom - GL_OFFSET,
          maxZoom: config.maxZoom - GL_OFFSET + 1,
          minZoom: MIN_ZOOM - GL_OFFSET,
          maxBounds: BARCELONA_BOUNDS,
          interactive,
          scrollZoom: interactive && wheelZoom !== false,
          cooperativeGestures: false,
          attributionControl: { compact: true },
          fadeDuration: 150,
          maxPitch: 70,
        });
        m.on("error", (e) => {
          // A style/tiles failure before the first render means no usable map: fall back.
          if (!m.loaded() && !disposed) {
            console.warn("[map] vector map unavailable, using raster tiles", e.error?.message);
            onFailRef.current();
          }
        });
        if (interactive && zoomControls) {
          m.addControl(new gl.NavigationControl({ visualizePitch: true }), "top-right");
          m.addControl(new TiltControl(), "top-right");
        }
        if (interactive) {
          m.on("click", (e) => {
            if (onMapClickRef.current) onMapClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            else onSelectRef.current?.(null);
          });
          m.on("moveend", () => renderRef.current());
        }
        map.current = m;
        // Credits stay one tap away (ⓘ), folded so they do not cover the map.
        const attrib = el.current.querySelector(".maplibregl-ctrl-attrib");
        attrib?.classList.remove("maplibregl-compact-show");
        attrib?.removeAttribute("open");
        frame(m);
        m.once("load", () => applySatellite());
        renderRef.current();
        drawUser();
      } catch (err) {
        if (!disposed) {
          console.warn("[map] vector map unavailable, using raster tiles", (err as Error).message);
          onFailRef.current();
        }
      }
    })();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Frames every marker inside the part of the map not covered by overlays. */
  function frame(m: ML.Map) {
    if (!fitMarkers || !markers.length) return;
    const pad = { top: fitMarkers.top ?? 24, right: fitMarkers.right ?? 24, bottom: fitMarkers.bottom ?? 24, left: fitMarkers.left ?? 24 };
    const el = m.getContainer();
    // Overlays larger than the map (small screens): frame the whole map instead.
    const fits = pad.left + pad.right < el.clientWidth - 80 && pad.top + pad.bottom < el.clientHeight - 80;
    const lngs = markers.map((mk) => mk.lng);
    const lats = markers.map((mk) => mk.lat);
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: fits ? pad : 24, maxZoom: (fitMarkers.maxZoom ?? 15) - GL_OFFSET, duration: 0 },
    );
  }

  function applySatellite() {
    const m = map.current;
    const style = styleRef.current;
    if (!m || !style || !m.isStyleLoaded() || !config.satelliteUrl) return;
    for (const [id, v] of satelliteVisibility(style, satellite)) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v);
  }
  useEffect(applySatellite, [satellite]); // eslint-disable-line react-hooks/exhaustive-deps

  function drawUser() {
    const gl = lib.current;
    const m = map.current;
    if (!gl || !m) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (user) {
      const wrap = document.createElement("div");
      wrap.innerHTML = '<div class="nx-user"><span></span></div>';
      wrap.style.pointerEvents = "none";
      userMarker.current = new gl.Marker({ element: wrap, anchor: "center" }).setLngLat([user.lng, user.lat]).addTo(m);
    }
  }
  useEffect(drawUser, [user]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.flyTo({ center: [center.lng, center.lat], zoom: Math.max(m.getZoom(), zoom - GL_OFFSET), duration: 700 });
  }, [center.lat, center.lng, recenterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={className} role="application" aria-label="Mapa" />;
}

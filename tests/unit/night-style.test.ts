import { describe, expect, it } from "vitest";
import { NIGHT, nightStyle } from "@/components/map/night-style";

describe("night map style", () => {
  const style = nightStyle({
    version: 8,
    sources: {},
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#fff" } },
      { id: "water", type: "fill", "source-layer": "water", paint: { "fill-color": "#9cf" } },
      { id: "park", type: "fill", "source-layer": "park", paint: { "fill-color": "#cfc", "fill-pattern": "x" } },
      { id: "highway-motorway", type: "line", "source-layer": "transportation", paint: { "line-color": "#f90" } },
      { id: "building-3d", type: "fill-extrusion", "source-layer": "building", paint: {} },
      { id: "poi_r1", type: "symbol", "source-layer": "poi", paint: {} },
      { id: "label_city", type: "symbol", "source-layer": "place", paint: { "text-color": "#000" } },
    ],
  });
  const byId = Object.fromEntries(style.layers.map((l) => [l.id, l]));

  it("recolors land, water, parks, roads and 3D buildings", () => {
    expect(byId.background!.paint!["background-color"]).toBe(NIGHT.land);
    expect(byId.water!.paint!["fill-color"]).toBe(NIGHT.water);
    expect(byId.park!.paint!["fill-color"]).toBe(NIGHT.park);
    expect(byId.park!.paint!["fill-pattern"]).toBeUndefined();
    expect(byId["highway-motorway"]!.paint!["line-color"]).toBe(NIGHT.motorway);
    expect(byId["building-3d"]!.paint!["fill-extrusion-color"]).toBe(NIGHT.building3d);
    expect(byId.label_city!.paint!["text-color"]).toBe(NIGHT.label);
  });

  it("drops third-party POI icons so our markers stand out", () => {
    expect(byId.poi_r1).toBeUndefined();
  });
});

describe("satellite view", async () => {
  const { withSatellite, satelliteVisibility } = await import("@/components/map/night-style");
  const base = withSatellite(
    {
      version: 8,
      sources: {},
      layers: [
        { id: "background", type: "background" },
        { id: "water", type: "fill" },
        { id: "label", type: "symbol" },
        { id: "hidden-label", type: "symbol", layout: { visibility: "none" } },
      ],
    },
    "https://tiles.example/{z}/{x}/{y}.jpeg",
    "© ICGC",
  );

  it("adds imagery right above the background, hidden by default", () => {
    expect(base.layers.map((l) => l.id)).toEqual(["background", "nx-satellite", "water", "label", "hidden-label"]);
    expect(base.sources["nx-satellite"]).toMatchObject({ type: "raster", tiles: ["https://tiles.example/{z}/{x}/{y}.jpeg"] });
  });

  it("shows imagery with labels only, and restores the map", () => {
    expect(Object.fromEntries(satelliteVisibility(base, true))).toEqual({ background: "none", "nx-satellite": "visible", water: "none", label: "visible", "hidden-label": "none" });
    expect(Object.fromEntries(satelliteVisibility(base, false))).toEqual({ background: "visible", "nx-satellite": "none", water: "visible", label: "visible", "hidden-label": "none" });
  });
});

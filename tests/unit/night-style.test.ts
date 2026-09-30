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

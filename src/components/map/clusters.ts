import Supercluster from "supercluster";
import type { MapMarker } from "./types";

/**
 * Provider-independent clustering (supercluster): any MapProvider asks for
 * the clusters of its current bounds/zoom and draws them its own way.
 */
export type ClusterItem =
  | { type: "cluster"; id: number; lat: number; lng: number; count: number; live: boolean }
  | { type: "marker"; marker: MapMarker };

interface PointProps {
  marker: MapMarker;
}
interface ClusterProps {
  live: boolean;
}

export class MarkerClusters {
  private index: Supercluster<PointProps, ClusterProps>;

  constructor(markers: MapMarker[], opts: { radius?: number; maxZoom?: number } = {}) {
    this.index = new Supercluster<PointProps, ClusterProps>({
      radius: opts.radius ?? 56,
      maxZoom: opts.maxZoom ?? 16,
      minPoints: 3,
      map: (p) => ({ live: Boolean(p.marker.live) }),
      reduce: (acc, p) => {
        acc.live = acc.live || p.live;
      },
    });
    this.index.load(
      markers.map((m) => ({ type: "Feature", properties: { marker: m }, geometry: { type: "Point", coordinates: [m.lng, m.lat] } })),
    );
  }

  /** bbox = [west, south, east, north] */
  items(bbox: [number, number, number, number], zoom: number): ClusterItem[] {
    return this.index.getClusters(bbox, Math.round(zoom)).map((f) => {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const p = f.properties as Partial<Supercluster.ClusterProperties> & Partial<PointProps> & Partial<ClusterProps>;
      if (p.cluster) return { type: "cluster", id: p.cluster_id!, lat, lng, count: p.point_count!, live: Boolean(p.live) };
      return { type: "marker", marker: p.marker! };
    });
  }

  expansionZoom(clusterId: number): number {
    return this.index.getClusterExpansionZoom(clusterId);
  }
}

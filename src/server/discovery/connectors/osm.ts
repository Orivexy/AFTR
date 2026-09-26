import "server-only";
import { osmProvider } from "../../places/providers/osm";
import type { Connector } from "../types";

/**
 * OpenStreetMap (Overpass API, ODbL): discovers nightclubs, dance clubs,
 * music and event venues of the source's city, with address, phone, web and
 * opening hours. config: { categories?: NightlifeCategory[], radiusKm?: number }
 */
export const osmConnector: Connector = {
  label: "OpenStreetMap · Overpass API (locales y horarios)",
  placeProvider: osmProvider,
};

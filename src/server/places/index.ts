import "server-only";
import type { PlaceProvider } from "./types";
import { osmProvider } from "./providers/osm";
import { googleProvider } from "./providers/google";

/** Registry of place providers (see docs/places-and-map.md to add one). */
export const PLACE_PROVIDERS = {
  osm: osmProvider,
  google: googleProvider,
} satisfies Record<string, PlaceProvider>;

export type PlaceProviderKey = keyof typeof PLACE_PROVIDERS;

export * from "./types";

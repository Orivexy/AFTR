/**
 * Shapes used by the discovery pipeline. Connectors return External* items
 * (as close to the source as possible); normalize.ts turns them into
 * Normalized* items in NIVEX's format. Nothing here is invented: missing
 * data stays null.
 */

/** A date-time as given by the source. */
export type SourceDateTime =
  | { kind: "instant"; iso: string } // absolute (has offset / Z)
  | { kind: "local"; date: string; time: string | null; tz?: string | null }; // wall-clock in a timezone (time null = all-day)

export interface ExternalPlace {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface ExternalEvent {
  externalId: string;
  title: string;
  description?: string | null;
  start: SourceDateTime | null;
  end?: SourceDateTime | null;
  doors?: SourceDateTime | null;
  place?: ExternalPlace | null;
  priceMin?: number | null; // cents
  priceMax?: number | null; // cents
  currency?: string | null;
  isFree?: boolean;
  ticketUrl?: string | null;
  officialUrl?: string | null;
  sourceUrl?: string | null;
  organizerName?: string | null;
  genres?: string[];
  categoryHint?: string | null;
  imageUrls?: string[];
  cancelled?: boolean;
  /** e.g. RRULE present — not expanded (skipped with a log line). */
  unsupported?: string | null;
}

export interface ExternalVenue {
  externalId: string;
  name: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  description?: string | null;
  types?: string[];
  genres?: string[];
  openingHours?: Record<string, Array<{ open: string; close: string }>> | null;
  imageUrls?: string[];
  googlePlaceId?: string | null;
  sourceUrl?: string | null;
}

export interface NormalizedEvent {
  title: string;
  description: string | null;
  startsAt: string; // ISO UTC
  endsAt: string | null;
  doorsAt: string | null;
  timezone: string;
  /** true when the source gave no start time (never guessed). */
  timeUnknown: boolean;
  venueId: string | null;
  venueName: string | null;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  ticketUrl: string | null;
  officialUrl: string | null;
  sourceUrl: string | null;
  organizerName: string | null;
  genres: string[];
  category: string;
  imageUrls: string[];
  cancelled: boolean;
}

export interface NormalizedVenue {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  description: string | null;
  genres: string[];
  type: "CLUB" | "BAR" | "CONCERT_HALL" | "OPEN_AIR" | "OTHER";
  openingHours: Record<string, Array<{ open: string; close: string }>> | null;
  googlePlaceId: string | null;
  sourceUrl: string | null;
  imageUrls: string[];
}

export interface SourceContext {
  sourceId: string;
  url: string | null;
  config: Record<string, unknown>;
  city: { id: string; name: string; lat: number; lng: number; timezone: string; searchRadiusKm: number; countryCode: string; currency: string };
  log: (line: string) => void;
}

export interface Connector {
  /** Human description for the admin panel. */
  label: string;
  fetchEvents?(ctx: SourceContext): Promise<ExternalEvent[]>;
  fetchVenues?(ctx: SourceContext): Promise<ExternalVenue[]>;
  /** Days that fetched data may be kept (provider caching terms). */
  retentionDays?: number;
}

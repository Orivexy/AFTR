import "server-only";
import type { DiscoverySourceType } from "@prisma/client";
import type { Connector } from "../types";
import { icsConnector } from "./ics";
import { jsonLdConnector } from "./jsonld";
import { partnerFeedConnector } from "./partner-feed";
import { ticketmasterConnector } from "./ticketmaster";
import { googlePlacesConnector } from "./google-places";
import { osmConnector } from "./osm";
import { madridAgendaConnector } from "./madrid-agenda";

/** Registry: add a DiscoverySourceType + a Connector here to support a new source. */
export const CONNECTORS: Record<DiscoverySourceType, Connector> = {
  ICS_FEED: icsConnector,
  JSON_LD_PAGE: jsonLdConnector,
  PARTNER_FEED: partnerFeedConnector,
  TICKETMASTER: ticketmasterConnector,
  GOOGLE_PLACES: googlePlacesConnector,
  OSM_OVERPASS: osmConnector,
  MADRID_AGENDA: madridAgendaConnector,
};

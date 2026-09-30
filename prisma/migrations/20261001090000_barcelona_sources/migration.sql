-- Barcelona open data: Generalitat agenda (events) and city council music venues.
ALTER TYPE "DiscoverySourceType" ADD VALUE IF NOT EXISTS 'CATALONIA_AGENDA';
ALTER TYPE "DiscoverySourceType" ADD VALUE IF NOT EXISTS 'BCN_MUSIC_VENUES';

-- The nightlife section is replaced by a verified list of Barcelona places
-- (src/server/discovery/curated/barcelona.ts). Every previous venue and
-- imported event is removed; the list and its events are imported again at
-- the next sync.

-- The verified list: the only source of places.
INSERT INTO "DiscoverySource" ("id", "key", "name", "type", "enabled", "cityId", "trust", "autoPublish", "allowImages", "syncIntervalMin", "config", "nextSyncAt", "updatedAt")
SELECT 'src_curated_bcn', 'barcelona-verified-venues', 'Listado verificado de Barcelona (web oficial de cada local)', 'CURATED', true, c."id", 'VERIFIED', true, true, 1440,
       '{"list": "barcelona", "listedVenuesOnly": true}'::jsonb, now(), now()
FROM "City" c WHERE c."slug" = 'barcelona'
ON CONFLICT ("key") DO NOTHING;

-- Other place sources off (OpenStreetMap, city registry, Google, cultural agenda).
UPDATE "DiscoverySource" SET "enabled" = false WHERE "type" IN ('OSM_OVERPASS', 'BCN_MUSIC_VENUES', 'GOOGLE_PLACES', 'CATALONIA_AGENDA');

-- Event sources: only events at a place of the list (parties, concerts, festivals…).
UPDATE "DiscoverySource"
SET "config" = (COALESCE("config", '{}'::jsonb) - 'nightlifeOnly' - 'nightClubsOnly') || '{"listedVenuesOnly": true}'::jsonb, "nextSyncAt" = now()
WHERE "type" IN ('JSON_LD_PAGE', 'TICKETMASTER', 'ICS_FEED', 'PARTNER_FEED');

-- Xceed: the general agenda plus the agenda pages of listed places it sells.
UPDATE "DiscoverySource"
SET "name" = 'Xceed · agenda de los locales verificados',
    "config" = "config" || '{"pages": ["https://xceed.me/en/barcelona/venue/sutton-barcelona", "https://xceed.me/en/barcelona/venue/nitsa-club", "https://xceed.me/en/barcelona/venue/draco-club", "https://xceed.me/es/barcelona/venue/la-biblio-bcn", "https://xceed.me/en/barcelona/venue/laut", "https://xceed.me/en/barcelona/venue/sidecar-factory-club"], "followLinks": {"pattern": "^https://xceed\\.me/(es|en)/barcelona/event/[^/]+/\\d+$", "max": 30}}'::jsonb
WHERE "key" = 'xceed-barcelona-clubs';

-- Remove every imported event and every venue (photos, reviews and follows go with them).
DELETE FROM "SourceEventRecord";
DELETE FROM "Event" WHERE "source" = 'IMPORT';
DELETE FROM "SourceVenueRecord";
DELETE FROM "Venue";

-- Event kinds.
UPDATE "Category" SET "name" = 'Fiesta de club' WHERE "slug" = 'discoteca';
UPDATE "Category" SET "name" = 'Sesión DJ' WHERE "slug" = 'dj';

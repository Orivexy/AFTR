-- Only club events: the club filter also applies to Ticketmaster; resync now.
UPDATE "DiscoverySource" SET "config" = COALESCE("config", '{}'::jsonb) || '{"nightlifeOnly": true}'::jsonb, "nextSyncAt" = now()
WHERE "type" IN ('TICKETMASTER', 'CATALONIA_AGENDA');

-- Club nights from Xceed's public agenda (schema.org Event data; robots.txt allows it).
INSERT INTO "DiscoverySource" ("id", "key", "name", "type", "enabled", "url", "cityId", "trust", "autoPublish", "allowImages", "syncIntervalMin", "config", "updatedAt")
SELECT 'src_xceed_bcn_clubs', 'xceed-barcelona-clubs', 'Xceed · fiestas en discotecas de Barcelona', 'JSON_LD_PAGE', true, 'https://xceed.me/es/barcelona/events', c."id", 'IMPORTED', true, true, 720,
       '{"followLinks": {"pattern": "^https://xceed\\.me/es/barcelona/event/[^/]+/\\d+$", "max": 60}, "nightClubsOnly": true}'::jsonb, now()
FROM "City" c WHERE c."slug" = 'barcelona'
ON CONFLICT ("key") DO NOTHING;

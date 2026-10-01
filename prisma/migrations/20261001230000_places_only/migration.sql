-- The app shows the verified places on the map only: no events.
UPDATE "DiscoverySource" SET "enabled" = false WHERE "key" = 'xceed-barcelona-clubs' OR "key" LIKE 'ticketmaster-bcn%';
UPDATE "DiscoverySource" SET "config" = COALESCE("config", '{}'::jsonb) || '{"events": false}'::jsonb WHERE "key" = 'barcelona-verified-venues';
DELETE FROM "Event";

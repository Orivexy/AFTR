-- Older installs have Barcelona's OpenStreetMap source under two keys: keep one.
UPDATE "DiscoverySource" SET "enabled" = false
WHERE "key" = 'osm-bcn-nightlife' AND EXISTS (SELECT 1 FROM "DiscoverySource" WHERE "key" = 'osm-barcelona-nightlife');

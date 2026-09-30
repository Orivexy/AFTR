-- Venue discovery (OpenStreetMap, no key) runs for every launch city, and
-- key-based sources are enabled: they wait quietly until their API key is set.
UPDATE "DiscoverySource" SET "enabled" = true
WHERE "key" LIKE 'osm-%-nightlife'
   OR "key" LIKE 'ticketmaster-%-music'
   OR "key" LIKE 'google-places-%-clubs';

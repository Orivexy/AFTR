-- Barcelona agenda: official photos, and only parties / festes majors / club nights.
UPDATE "DiscoverySource" SET "allowImages" = true, "config" = COALESCE("config", '{}'::jsonb) || '{"nightlifeOnly": true}'::jsonb, "nextSyncAt" = now()
WHERE "key" = 'catalonia-agenda-bcn';
-- City council list is authoritative: places left out (restaurants, cocktail bars…) leave the map.
UPDATE "DiscoverySource" SET "config" = COALESCE("config", '{}'::jsonb) || '{"authoritative": true}'::jsonb, "nextSyncAt" = now()
WHERE "key" = 'bcn-open-data-music-venues';

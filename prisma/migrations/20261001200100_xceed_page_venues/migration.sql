-- Events read from a venue's own Xceed page are at that venue.
UPDATE "DiscoverySource"
SET "config" = "config" || '{"pageVenues": {"https://xceed.me/en/barcelona/venue/sutton-barcelona": "Sutton Barcelona", "https://xceed.me/en/barcelona/venue/nitsa-club": "Nitsa Club", "https://xceed.me/en/barcelona/venue/draco-club": "Draco Disco Club", "https://xceed.me/es/barcelona/venue/la-biblio-bcn": "La Biblio", "https://xceed.me/en/barcelona/venue/laut": "LAUT", "https://xceed.me/en/barcelona/venue/sidecar-factory-club": "Club Sauvage"}}'::jsonb,
    "nextSyncAt" = now()
WHERE "key" = 'xceed-barcelona-clubs';

-- Locations are checked again (two were matched to a street of another town).
UPDATE "Venue" SET "district" = NULL WHERE "primarySourceId" = 'src_curated_bcn';
UPDATE "DiscoverySource" SET "nextSyncAt" = now() WHERE "key" = 'barcelona-verified-venues';

-- Official photos are imported again with their source, so the zones detected
-- by the image model can be matched to them (the files are swept as orphans).
DELETE FROM "Photo" p
USING "Profile" pr
WHERE pr."userId" = p."uploaderId" AND pr."username" = 'orivexy_discovery'
  AND p."venueId" IN (SELECT "id" FROM "Venue" WHERE "primarySourceId" = 'src_curated_bcn')
  AND p."sourceUrl" IS NULL;
UPDATE "Venue" v SET "coverKey" = NULL
WHERE v."primarySourceId" = 'src_curated_bcn'
  AND NOT EXISTS (SELECT 1 FROM "Photo" p WHERE p."venueId" = v."id" AND p."key" = v."coverKey");

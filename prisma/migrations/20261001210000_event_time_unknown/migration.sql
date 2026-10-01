-- Events whose source gives the date but not the start time ("hora no publicada").
ALTER TABLE "Event" ADD COLUMN "timeUnknown" BOOLEAN NOT NULL DEFAULT false;
-- Retry the official events that were held only for the missing time.
UPDATE "DiscoverySource" SET "nextSyncAt" = now() WHERE "key" = 'barcelona-verified-venues';

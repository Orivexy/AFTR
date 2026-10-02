-- Events are back (listed on the home page, not on the map): their sources run again.
UPDATE "DiscoverySource" SET "enabled" = true, "nextSyncAt" = now() WHERE "key" = 'xceed-barcelona-clubs' OR "key" LIKE 'ticketmaster-bcn%';
UPDATE "DiscoverySource" SET "config" = "config" - 'events', "nextSyncAt" = now() WHERE "key" = 'barcelona-verified-venues';

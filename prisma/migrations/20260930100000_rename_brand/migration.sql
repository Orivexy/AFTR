-- Brand renamed to (Nombre en proceso): brand-neutral ticketing enum value and
-- the technical account that owns imported events.
ALTER TYPE "TicketProvider" RENAME VALUE 'NIVEX' TO 'PLATFORM';

UPDATE "Profile" SET "username" = 'orivexy_discovery', "displayName" = '(Nombre en proceso) Discovery'
WHERE "username" = 'nivex_discovery'
  AND NOT EXISTS (SELECT 1 FROM "Profile" WHERE "username" = 'orivexy_discovery');

-- Provisional product name: the discovery account loses the old one.
UPDATE "Profile" SET "username" = 'descubrimiento', "displayName" = 'Descubrimiento'
WHERE "username" = 'orivexy_discovery' AND NOT EXISTS (SELECT 1 FROM "Profile" WHERE "username" = 'descubrimiento');

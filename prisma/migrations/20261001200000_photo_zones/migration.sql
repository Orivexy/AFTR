-- Imported photos keep their source URL and the part of the place they show
-- (detected by the image model: dance floor, DJ booth, VIP area, bar…).
ALTER TABLE "Photo" ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "zone" TEXT,
ADD COLUMN "zoneScore" DOUBLE PRECISION;

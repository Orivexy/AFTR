-- AlterTable
ALTER TABLE "SourceVenueRecord" ADD COLUMN     "missedSyncs" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SourceVenueRecord_venueId_idx" ON "SourceVenueRecord"("venueId");

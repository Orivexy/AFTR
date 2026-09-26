-- AlterEnum
ALTER TYPE "DiscoverySourceType" ADD VALUE 'OSM_OVERPASS';

-- AlterTable
ALTER TABLE "DiscoverySource" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailureAt" TIMESTAMP(3),
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "job" TEXT,
ALTER COLUMN "sourceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "fieldUpdatedAt" JSONB,
ADD COLUMN     "hoursSource" TEXT,
ADD COLUMN     "hoursUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "inactiveReason" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "nextSyncAt" TIMESTAMP(3),
ADD COLUMN     "primarySourceId" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "VenueChange" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "sourceId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMin" INTEGER,
    "status" "DiscoverySyncStatus" NOT NULL DEFAULT 'IDLE',
    "lockedUntil" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastResult" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "provider" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("provider","day")
);

-- CreateIndex
CREATE INDEX "VenueChange_venueId_createdAt_idx" ON "VenueChange"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "VenueChange_createdAt_idx" ON "VenueChange"("createdAt");

-- CreateIndex
CREATE INDEX "SyncRun_job_startedAt_idx" ON "SyncRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "Venue_primarySourceId_idx" ON "Venue"("primarySourceId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "DiscoverySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueChange" ADD CONSTRAINT "VenueChange_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueChange" ADD CONSTRAINT "VenueChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DiscoverySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

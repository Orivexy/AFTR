-- NIVEX no longer ships fictional content: remove any demo rows created by
-- the old demo seed (e.g. existing desktop installs), then the flags.
-- Orphaned photos/videos are removed with their files by the cleanup-uploads job.
DELETE FROM "Post" WHERE "isDemo";
DELETE FROM "Event" WHERE "isDemo";
DELETE FROM "Venue" WHERE "isDemo";
DELETE FROM "User" WHERE "id" IN (SELECT "userId" FROM "Profile" WHERE "isDemo");

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "isDemo";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "isDemo";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "isDemo";

-- AlterTable
ALTER TABLE "Venue" DROP COLUMN "isDemo";

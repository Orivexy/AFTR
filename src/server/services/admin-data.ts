import "server-only";
import type { DiscoverySourceType } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { CONNECTORS } from "../discovery/connectors";
import { intervalMinutes, sourceKind } from "../discovery/engine";
import { usageSummary } from "../places/usage";
import { syncJobsOverview } from "../sync/jobs";

/** Read models for /admin/map-data and /admin/event-data. */

async function sourcesOfKind(kind: "venues" | "events") {
  const sources = await db.discoverySource.findMany({ orderBy: { createdAt: "asc" }, include: { city: { select: { name: true } } } });
  return sources
    .filter((s) => sourceKind(s.type) === kind)
    .map((s) => {
      const provider = CONNECTORS[s.type].placeProvider;
      return {
        id: s.id, name: s.name, type: s.type, city: s.city.name, enabled: s.enabled, status: s.status, lastError: s.lastError,
        lastSuccessAt: s.lastSuccessAt, lastFailureAt: s.lastFailureAt, nextSyncAt: s.nextSyncAt, consecutiveFailures: s.consecutiveFailures,
        found: s.eventsFound, intervalMin: intervalMinutes(s), label: CONNECTORS[s.type].label,
        policy: provider?.policy ?? null,
        needsKey: (s.type === "TICKETMASTER" && !env.TICKETMASTER_API_KEY) || (s.type === "GOOGLE_PLACES" && !env.GOOGLE_PLACES_API_KEY),
      };
    });
}

async function recentRuns(jobs: string[], kind: "venues" | "events") {
  const types = (Object.keys(CONNECTORS) as DiscoverySourceType[]).filter((t) => sourceKind(t) === kind);
  const runs = await db.syncRun.findMany({
    where: { OR: [{ job: { in: jobs } }, { source: { type: { in: types } } }] },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { source: { select: { name: true } } },
  });
  return runs;
}

export async function mapDataOverview() {
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86400_000);
  const month = new Date(now.getTime() - 30 * 86400_000);
  const [total, active, inactive, created7, updatedVenueIds, closed30, withHours, withoutAddress, bySource, jobs, sources, usage, changes, flags, runs] = await Promise.all([
    db.venue.count(),
    db.venue.count({ where: { isActive: true } }),
    db.venue.count({ where: { isActive: false } }),
    db.venue.count({ where: { createdAt: { gte: week } } }),
    db.venueChange.findMany({ where: { createdAt: { gte: week } }, distinct: ["venueId"], select: { venueId: true } }),
    db.venue.count({ where: { closedAt: { gte: month } } }),
    db.venue.count({ where: { isActive: true, openingHours: { not: { equals: null } } } }),
    db.venue.count({ where: { isActive: true, address: "" } }),
    db.venue.groupBy({ by: ["trust"], where: { isActive: true }, _count: { _all: true } }),
    syncJobsOverview(),
    sourcesOfKind("venues"),
    usageSummary(30),
    db.venueChange.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { venue: { select: { name: true, slug: true } }, source: { select: { name: true } } } }),
    // Linked places a source flags for review (e.g. "closed permanently" on a venue we don't own).
    db.sourceVenueRecord.findMany({
      where: { venueId: { not: null }, NOT: { reviewReasons: { isEmpty: true } } },
      take: 20,
      include: { venue: { select: { name: true, slug: true } }, source: { select: { name: true } } },
    }),
    recentRuns(["VENUE_SYNC", "VENUE_HOURS_SYNC"], "venues"),
  ]);
  return {
    totals: { total, active, inactive, created7, updated7: updatedVenueIds.length, closed30, withHours, withoutAddress },
    byTrust: Object.fromEntries(bySource.map((b) => [b.trust, b._count._all])),
    jobs: jobs.filter((j) => j.name !== "EVENT_SYNC"),
    sources,
    usage,
    changes,
    flags,
    runs,
  };
}

export async function eventDataOverview() {
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86400_000);
  const notEnded = { OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gt: new Date(now.getTime() - 6 * 3600_000) } }] };
  const [upcoming, upcomingImported, created7, modifiedIds, expired7, inactive, mergedDuplicates, possibleDuplicates, withoutVenue, pendingReview, jobs, sources, runs, changes] = await Promise.all([
    db.event.count({ where: { status: "PUBLISHED", ...notEnded } }),
    db.event.count({ where: { status: "PUBLISHED", source: "IMPORT", ...notEnded } }),
    db.event.count({ where: { createdAt: { gte: week } } }),
    db.eventChange.findMany({ where: { createdAt: { gte: week } }, distinct: ["eventId"], select: { eventId: true } }),
    // Ended during the last 7 days: no longer shown anywhere as upcoming.
    db.event.count({ where: { status: "PUBLISHED", OR: [{ endsAt: { gte: week, lte: now } }, { endsAt: null, startsAt: { gte: new Date(week.getTime() - 6 * 3600_000), lte: new Date(now.getTime() - 6 * 3600_000) } }] } }),
    db.event.count({ where: { status: "INACTIVE" } }),
    db.sourceEventRecord.count({ where: { reviewStatus: { in: ["AUTO", "MERGED"] }, matchScore: { not: null } } }),
    db.sourceEventRecord.count({ where: { reviewStatus: "PENDING", duplicateOfId: { not: null } } }),
    db.event.count({ where: { status: "PUBLISHED", source: "IMPORT", venueId: null, ...notEnded } }),
    db.sourceEventRecord.count({ where: { reviewStatus: "PENDING" } }),
    syncJobsOverview(),
    sourcesOfKind("events"),
    recentRuns(["EVENT_SYNC"], "events"),
    db.eventChange.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { event: { select: { title: true, slug: true } }, source: { select: { name: true } } } }),
  ]);
  return {
    totals: { upcoming, upcomingImported, created7, modified7: modifiedIds.length, expired7, inactive, mergedDuplicates, possibleDuplicates, withoutVenue, pendingReview },
    jobs: jobs.filter((j) => j.name === "EVENT_SYNC"),
    sources,
    runs,
    changes,
  };
}

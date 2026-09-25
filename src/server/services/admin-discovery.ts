import "server-only";
import { db } from "../db";
import { CONNECTORS } from "../discovery/connectors";
import { intervalMinutes } from "../discovery/engine";
import { env } from "../env";

/** Read models for /admin/discovery. */
export async function discoveryOverview() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const [sources, runs24, pendingEvents, pendingVenues, imported, recentRuns] = await Promise.all([
    db.discoverySource.findMany({
      orderBy: { createdAt: "asc" },
      include: { city: { select: { name: true } }, venue: { select: { name: true, slug: true } }, _count: { select: { eventRecords: true } } },
    }),
    db.syncRun.aggregate({ where: { startedAt: { gte: since } }, _sum: { found: true, created: true, updated: true, duplicates: true, queued: true, errors: true, deactivated: true }, _count: { _all: true } }),
    db.sourceEventRecord.count({ where: { reviewStatus: "PENDING" } }),
    db.sourceVenueRecord.count({ where: { reviewStatus: "PENDING" } }),
    db.event.count({ where: { source: "IMPORT", status: "PUBLISHED" } }),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 15, include: { source: { select: { name: true } } } }),
  ]);
  return {
    sources: sources.map((s) => ({
      ...s,
      intervalMin: intervalMinutes(s),
      connectorLabel: CONNECTORS[s.type].label,
      needsKey: (s.type === "TICKETMASTER" && !env.TICKETMASTER_API_KEY) || (s.type === "GOOGLE_PLACES" && !env.GOOGLE_PLACES_API_KEY),
    })),
    last24h: { runs: runs24._count._all, ...runs24._sum },
    pendingEvents,
    pendingVenues,
    imported,
    recentRuns,
    engineEnabled: env.DISCOVERY_ENABLED,
    defaultInterval: env.EVENT_SYNC_INTERVAL,
  };
}

export async function reviewQueue() {
  const [events, venues, cityVenues] = await Promise.all([
    db.sourceEventRecord.findMany({
      where: { reviewStatus: "PENDING" },
      orderBy: { importedAt: "asc" },
      take: 50,
      include: { source: { select: { name: true, city: { select: { id: true } } } } },
    }),
    db.sourceVenueRecord.findMany({ where: { reviewStatus: "PENDING" }, orderBy: { importedAt: "asc" }, take: 50, include: { source: { select: { name: true } } } }),
    db.venue.findMany({ where: { isActive: true }, select: { id: true, name: true, cityId: true }, orderBy: { name: "asc" } }),
  ]);
  const dupIds = events.map((e) => e.duplicateOfId).filter((x): x is string => Boolean(x));
  const dups = dupIds.length ? await db.event.findMany({ where: { id: { in: dupIds } }, select: { id: true, slug: true, title: true } }) : [];
  return { events, venues, cityVenues, duplicates: new Map(dups.map((d) => [d.id, d])) };
}

export async function eventDiscoveryHistory(eventId: string) {
  return db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, slug: true, title: true, trust: true, source: true, status: true, importedAt: true, lastSyncedAt: true,
      primarySource: { select: { name: true } },
      sourceRecords: { select: { id: true, reviewStatus: true, sourceUrl: true, lastSeenAt: true, missedSyncs: true, source: { select: { name: true } } } },
      changes: { orderBy: { createdAt: "desc" }, take: 100, include: { source: { select: { name: true } } } },
    },
  });
}

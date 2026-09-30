import "server-only";
import { existsSync } from "node:fs";
import { db } from "../db";
import { env } from "../env";
import { withSnapshotReplay } from "./fetcher";
import { runDueSources } from "./engine";

/**
 * First launch of an installed app (or first launch after an update that
 * replaced every venue): fills the empty database from the
 * snapshot shipped with it (real public data recorded by CI when the app was
 * built), then schedules live syncs a couple of minutes later so everything
 * is refreshed from the Internet as soon as there is a connection.
 */
export async function importSnapshotIfEmpty() {
  const dir = env.DISCOVERY_SNAPSHOT_DIR;
  if (!dir || !existsSync(dir)) return { skipped: "sin instantánea" };
  // Also after an update that replaced the whole list of places (the new app ships the new snapshot).
  if ((await db.venue.count()) > 0) return { skipped: "ya importada" };

  const started = Date.now();
  const result = await withSnapshotReplay(dir, async () => ({
    venues: await runDueSources("venues", { force: true, job: "SNAPSHOT" }),
    events: await runDueSources("events", { force: true, job: "SNAPSHOT" }),
  }));
  await db.discoverySource.updateMany({ where: { enabled: true }, data: { nextSyncAt: new Date(Date.now() + 2 * 60_000) } });
  const [venues, events] = await Promise.all([db.venue.count(), db.event.count({ where: { status: "PUBLISHED" } })]);
  return { ms: Date.now() - started, venues, events, sources: result.venues.ok + result.events.ok };
}

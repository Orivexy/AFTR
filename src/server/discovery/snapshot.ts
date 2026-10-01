import "server-only";
import { existsSync } from "node:fs";
import { db } from "../db";
import { env } from "../env";
import { withSnapshotReplay } from "./fetcher";
import { runDueSources } from "./engine";
import { setSnapshotImporting } from "./import-state";

/**
 * First launch of an installed app (or first launch after an update that
 * replaced every venue): fills the empty database from the
 * snapshot shipped with it (real public data recorded by CI when the app was
 * built), then schedules live syncs a couple of minutes later so everything
 * is refreshed from the Internet as soon as there is a connection.
 */
// If the import is requested twice (e.g. a retry), the second call waits for the first.
let inFlight: Promise<Awaited<ReturnType<typeof importSnapshot>>> | null = null;

export async function importSnapshotIfEmpty() {
  const dir = env.DISCOVERY_SNAPSHOT_DIR;
  if (!dir || !existsSync(dir)) return { skipped: "sin instantánea" };
  if (inFlight) return inFlight;
  setSnapshotImporting(true);
  inFlight = importSnapshot(dir).finally(() => {
    setSnapshotImporting(false);
    inFlight = null;
  });
  return inFlight;
}

async function importSnapshot(dir: string) {
  // Also after an update that replaced the whole list of places (the new app ships the new snapshot).
  if ((await db.venue.count()) > 0) return { skipped: "ya importada" };

  const started = Date.now();
  // Locks left by a sync of a previous run of the app (closed mid-sync) would make the import skip that source.
  await db.discoverySource.updateMany({ where: { lockedUntil: { not: null } }, data: { lockedUntil: null } });
  // A live sync that started just before the import may hold a source for a
  // moment: wait for it and try again (bounded), so no source is left out.
  const run = async (kind: "venues" | "events") => {
    let r = await runDueSources(kind, { force: true, job: "SNAPSHOT" });
    for (let i = 0; i < 12 && r.skipped?.length; i++) {
      await new Promise((ok) => setTimeout(ok, 5_000));
      r = await runDueSources(kind, { force: true, job: "SNAPSHOT" });
    }
    return r;
  };
  const result = await withSnapshotReplay(dir, async () => ({ venues: await run("venues"), events: await run("events") }));
  await db.discoverySource.updateMany({ where: { enabled: true }, data: { nextSyncAt: new Date(Date.now() + 2 * 60_000) } });
  const [venues, events] = await Promise.all([db.venue.count(), db.event.count({ where: { status: "PUBLISHED" } })]);
  const errors = [...result.venues.errors, ...result.events.errors, ...(result.venues.skipped ?? []), ...(result.events.skipped ?? [])];
  return { ms: Date.now() - started, venues, events, sources: result.venues.ok + result.events.ok, ...(errors.length ? { errors } : {}) };
}

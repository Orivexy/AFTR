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
export async function importSnapshotIfEmpty() {
  const dir = env.DISCOVERY_SNAPSHOT_DIR;
  if (!dir || !existsSync(dir)) return { skipped: "sin instantánea" };
  // Also after an update that replaced the whole list of places (the new app ships the new snapshot).
  if ((await db.venue.count()) > 0) return { skipped: "ya importada" };

  const started = Date.now();
  setSnapshotImporting(true);
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
  const result = await withSnapshotReplay(dir, async () => ({ venues: await run("venues"), events: await run("events") })).finally(() =>
    setSnapshotImporting(false),
  );
  await db.discoverySource.updateMany({ where: { enabled: true }, data: { nextSyncAt: new Date(Date.now() + 2 * 60_000) } });
  const [venues, events] = await Promise.all([db.venue.count(), db.event.count({ where: { status: "PUBLISHED" } })]);
  const errors = [...result.venues.errors, ...result.events.errors, ...(result.venues.skipped ?? []), ...(result.events.skipped ?? [])];
  return { ms: Date.now() - started, venues, events, sources: result.venues.ok + result.events.ok, ...(errors.length ? { errors } : {}) };
}

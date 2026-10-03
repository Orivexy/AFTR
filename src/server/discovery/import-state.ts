/**
 * While the first-launch import replays the bundled snapshot, the regular
 * live syncs wait: otherwise they take the sources' locks first and the
 * import skips them as "busy" (the map would miss their events offline).
 */
import { existsSync } from "node:fs";
import { db } from "../db";
import { env } from "../env";

// Kept on globalThis: the in-process jobs (instrumentation) and the route
// that runs the import are separate module instances in the same process.
const state = ((globalThis as unknown as { __snapshotImport?: { importing: boolean; attempted: boolean } }).__snapshotImport ??= {
  importing: false,
  attempted: false,
});

/**
 * A bundled copy is waiting to be imported (first launch, or after an update
 * that replaced every venue). Once an import was attempted in this process,
 * live syncs go ahead whatever its result (never blocked for good).
 */
export async function snapshotPending(): Promise<boolean> {
  if (state.attempted) return false;
  const dir = env.DISCOVERY_SNAPSHOT_DIR;
  return Boolean(dir && existsSync(dir)) && (await db.venue.count()) === 0;
}
export const isSnapshotImporting = () => state.importing;
export function setSnapshotImporting(v: boolean) {
  state.importing = v;
  if (!v) state.attempted = true;
}

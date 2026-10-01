/**
 * While the first-launch import replays the bundled snapshot, the regular
 * live syncs wait: otherwise they take the sources' locks first and the
 * import skips them as "busy" (the map would miss their events offline).
 */
import { existsSync } from "node:fs";
import { db } from "../db";
import { env } from "../env";

let importing = false;
let attempted = false;

/**
 * A bundled copy is waiting to be imported (first launch, or after an update
 * that replaced every venue). Once an import was attempted in this process,
 * live syncs go ahead whatever its result (never blocked for good).
 */
export async function snapshotPending(): Promise<boolean> {
  if (attempted) return false;
  const dir = env.DISCOVERY_SNAPSHOT_DIR;
  return Boolean(dir && existsSync(dir)) && (await db.venue.count()) === 0;
}
export const isSnapshotImporting = () => importing;
export function setSnapshotImporting(v: boolean) {
  importing = v;
  if (!v) attempted = true;
}

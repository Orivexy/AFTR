/**
 * While the first-launch import replays the bundled snapshot, the regular
 * live syncs wait: otherwise they take the sources' locks first and the
 * import skips them as "busy" (the map would miss their events offline).
 */
let importing = false;
export const isSnapshotImporting = () => importing;
export function setSnapshotImporting(v: boolean) {
  importing = v;
}

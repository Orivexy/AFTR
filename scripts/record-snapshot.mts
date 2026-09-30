/**
 * Records the responses of every keyless public source (OpenStreetMap,
 * city open-data agendas) into a folder, by running the real syncs against
 * the build database. The desktop app ships that folder and replays it on
 * its first launch, so the map is full from the start; live syncs refresh
 * it right after. Nothing here is invented: it is what the sources returned
 * on the day the app was built.
 *   DATABASE_URL=… npx tsx --conditions=react-server scripts/record-snapshot.mts DIR
 */
import { readdirSync } from "node:fs";

const dir = process.argv[2];
if (!dir) throw new Error("Uso: record-snapshot.mts DIR");
process.env.DISCOVERY_SNAPSHOT_RECORD = dir;

const { syncSource, sourceKind } = await import("../src/server/discovery/engine");
const { CONNECTORS } = await import("../src/server/discovery/connectors");
const { db } = await import("../src/server/db");

// Same selection as the scheduler (enabled, not waiting for a key), venues first.
const sources = (await db.discoverySource.findMany({ where: { enabled: true }, select: { id: true, type: true, name: true } }))
  .filter((s) => !CONNECTORS[s.type].missingConfig?.())
  .sort((a, b) => (sourceKind(a.type) === "venues" ? 0 : 1) - (sourceKind(b.type) === "venues" ? 0 : 1));
let ok = 0;
for (const s of sources) {
  const t = Date.now();
  const r = await syncSource(s.id, { job: "SNAPSHOT" });
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  if ("skipped" in r) console.log(`  – ${s.name}: omitida (${r.reason ?? "ocupada"})`);
  else if (r.error) console.error(`  ✗ ${s.name} (${secs} s): ${r.error}`);
  else {
    ok++;
    console.log(`  ✓ ${s.name} (${secs} s): ${r.counters.found} encontrados, ${r.counters.created} nuevos`);
  }
}
const [v, ev] = await Promise.all([db.venue.count(), db.event.count({ where: { status: "PUBLISHED" } })]);
const files = readdirSync(dir).filter((f) => f.endsWith(".gz")).length;
console.log(`Instantánea: ${files} respuestas · ${v} locales · ${ev} eventos publicados (${ok}/${sources.length} fuentes OK)`);
await db.$disconnect();
// The app must not ship without the map: no venues means no snapshot.
if (v === 0) process.exit(1);

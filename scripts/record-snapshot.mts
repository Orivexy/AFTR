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

const { runDueSources } = await import("../src/server/discovery/engine");
const { db } = await import("../src/server/db");

const venues = await runDueSources("venues", { force: true, job: "SNAPSHOT" });
const events = await runDueSources("events", { force: true, job: "SNAPSHOT" });
for (const e of [...venues.errors, ...events.errors]) console.error(`  ✗ ${e}`);
const [v, ev] = await Promise.all([db.venue.count(), db.event.count({ where: { status: "PUBLISHED" } })]);
const files = readdirSync(dir).filter((f) => f.endsWith(".gz")).length;
console.log(`Instantánea: ${files} respuestas · ${v} locales · ${ev} eventos publicados (${venues.ok + events.ok} fuentes OK, ${venues.failed + events.failed} con error)`);
await db.$disconnect();
// The app must not ship without the map: no venues means no snapshot.
if (v === 0) process.exit(1);

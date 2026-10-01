/**
 * Small neural network that tells which part of a place each official photo
 * shows: dance floor, DJ booth, VIP area, bar, stage, terrace, entrance.
 *
 * Model: CLIP ViT-B/32 (quantized, ~90 MB, runs on CPU with ONNX Runtime via
 * Transformers.js), used zero-shot: each photo is compared with short
 * descriptions of every zone (src/lib/zones.ts) and only confident answers
 * are kept. It is not perfect, so the app labels the result as detected
 * automatically.
 *
 * Runs where the photos are (CI after the snapshot, or a server):
 *   DATABASE_URL=… npx tsx --conditions=react-server scripts/classify-zones.mts [OUT.json]
 * Writes the zone on each photo and, with OUT.json, the results keyed by the
 * photo's source URL; the desktop app ships that file and applies it to the
 * same photos when it imports them (src/server/zones.ts).
 */
import { writeFileSync } from "node:fs";
import { pickZone, zonePrompts } from "../src/lib/zones";

const MODEL = process.env.ZONE_MODEL ?? "Xenova/clip-vit-base-patch32";
const out = process.argv[2];

const { db } = await import("../src/server/db");
const { storage } = await import("../src/server/storage");
const { pipeline, RawImage, env } = await import("@huggingface/transformers");
env.cacheDir = process.env.ZONE_MODEL_CACHE ?? ".cache/transformers";

async function bytes(key: string): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = (await storage.read(key)).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

const started = Date.now();
type Classifier = (image: unknown, labels: string[], opts: { hypothesis_template: string }) => Promise<Array<{ label: string; score: number }>>;
let classify: Classifier;
try {
  classify = (await pipeline("zero-shot-image-classification", MODEL, { dtype: "q8" })) as unknown as Classifier;
} catch (err) {
  console.warn(`Modelo cuantizado no disponible (${(err as Error).message}); se usa el completo`);
  classify = (await pipeline("zero-shot-image-classification", MODEL)) as unknown as Classifier;
}
console.log(`Modelo ${MODEL} cargado en ${((Date.now() - started) / 1000).toFixed(1)} s`);

const prompts = zonePrompts().map((p) => p.prompt);
const photos = await db.photo.findMany({
  where: { sourceUrl: { not: null }, venueId: { not: null }, status: "VISIBLE" },
  select: { id: true, key: true, sourceUrl: true, venue: { select: { name: true } } },
});
const results: Record<string, { zone: string; score: number }> = {};
const counts = new Map<string, number>();
for (const p of photos) {
  try {
    const image = await RawImage.fromBlob(new Blob([new Uint8Array(await bytes(`${p.key}_sm.webp`))], { type: "image/webp" }));
    const scores = await classify(image, prompts, { hypothesis_template: "{}" });
    const zone = pickZone(scores);
    await db.photo.update({ where: { id: p.id }, data: { zone: zone?.zone ?? null, zoneScore: zone?.score ?? null } });
    if (zone) results[p.sourceUrl!] = zone;
    counts.set(zone?.zone ?? "sin zona", (counts.get(zone?.zone ?? "sin zona") ?? 0) + 1);
    console.log(`  · ${p.venue?.name}: ${zone ? `${zone.zone} (${Math.round(zone.score * 100)} %)` : "sin zona clara"}`);
  } catch (err) {
    console.warn(`  ✗ ${p.venue?.name} ${p.key}: ${(err as Error).message}`);
  }
}
if (out) writeFileSync(out, JSON.stringify({ model: MODEL, createdAt: new Date().toISOString(), photos: results }));
console.log(`Zonas: ${photos.length} fotos en ${((Date.now() - started) / 1000).toFixed(0)} s · ${[...counts].map(([z, n]) => `${z} ${n}`).join(" · ")}`);
await db.$disconnect();

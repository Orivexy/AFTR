/**
 * Screenshots of the running desktop app for the README and the release
 * (CI, Linux job, after the smoke test): real data of the first launch,
 * the macOS-style window and the live map tiles.
 *   node scripts/screenshots.mjs http://localhost:3000 OUT_DIR
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [base = "http://localhost:3000", out = "screenshots"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
// Google Chrome is preinstalled on CI runners; locally, Playwright's Chromium.
const browser = await chromium.launch({ channel: "chrome", args }).catch(() => chromium.launch({ args }));
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  // The macOS-style window the desktop app shows.
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 OrivexyDesktop/mac",
  colorScheme: "dark",
});
const page = await context.newPage();
const shot = async (name, wait = 2500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(out, `screenshot-${name}.png`) });
  console.log(`✓ ${name}`);
};
const tryStep = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    console.log(`✗ ${name}: ${err.message}`);
  }
};

await tryStep("home", async () => {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  // First page of a cold start: give the map tiles time to arrive.
  await shot("home", 8000);
});
await tryStep("map", async () => {
  await page.goto(`${base}/map`, { waitUntil: "networkidle" });
  await shot("map", 6000);
});
await tryStep("satellite", async () => {
  await page.getByRole("button", { name: "Ver satélite" }).click();
  await shot("satellite", 6000);
});
await tryStep("venue", async () => {
  // A verified place's page (photos from its website, zones), taken from the map's places.
  const res = await page.request.get(`${base}/api/map/places`);
  const { places } = await res.json();
  const slug = (places ?? []).find((p) => p.kind === "venue" && p.coverKey)?.slug ?? places?.[0]?.slug;
  if (!slug) throw new Error("sin lugares en el mapa");
  await page.goto(`${base}/venues/${slug}`, { waitUntil: "networkidle" });
  await shot("venue", 3000);
});
await browser.close();

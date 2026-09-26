// Generates the app icons (PWA, Apple touch icon, desktop) from the logo mark.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (size, padding) => {
  const r = (size / 2) * (1 - padding);
  const c = size / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="#07070b"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="#d7ff3a"/>
  <circle cx="${c + r * 0.36}" cy="${c - r * 0.36}" r="${r * 0.58}" fill="#07070b"/>
</svg>`);
};

mkdirSync("public/icons", { recursive: true });
mkdirSync("desktop/build", { recursive: true });
const out = [
  ["public/icons/icon-192.png", 192, 0.3],
  ["public/icons/icon-512.png", 512, 0.3],
  ["public/icons/maskable-512.png", 512, 0.45],
  ["public/icons/apple-touch-icon.png", 180, 0.3],
  ["public/icons/favicon-32.png", 32, 0.1],
  ["desktop/build/icon.png", 512, 0.2],
];
for (const [file, size, pad] of out) await sharp(svg(size, pad)).png().toFile(file);
console.log("icons ok");

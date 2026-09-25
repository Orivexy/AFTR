/**
 * Procedural "nightlife" artwork for demo data: neon light blobs, stage
 * beams, bokeh and a crowd silhouette. Rendered from SVG with sharp, so the
 * demo works fully offline and never uses real photos of real places.
 */
import sharp from "sharp";
import { createRandom, hashString, type Random } from "./random";

const PALETTES = [
  ["#ff2e88", "#7b2cff", "#1a0633"],
  ["#00e5ff", "#3d5afe", "#050b2e"],
  ["#ffb300", "#ff3d00", "#2a0800"],
  ["#c6ff3d", "#00bfa5", "#021a14"],
  ["#ff6ec7", "#ffa94d", "#2b0a1e"],
  ["#8c7bff", "#ff4d6d", "#10061f"],
  ["#40c4ff", "#e040fb", "#0a0420"],
  ["#ff1744", "#651fff", "#12001f"],
] as const;

function blobs(r: Random, w: number, h: number, colors: readonly string[]) {
  let defs = "";
  let shapes = "";
  const n = r.int(3, 5);
  for (let i = 0; i < n; i++) {
    const c = colors[i % 2]!;
    const id = `g${i}`;
    defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${r.float(0.35, 0.65).toFixed(2)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    const cx = r.float(-0.1, 1.1) * w;
    const cy = r.float(-0.1, 0.75) * h;
    const rad = r.float(0.2, 0.45) * Math.max(w, h);
    shapes += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="url(#${id})"/>`;
  }
  return { defs, shapes };
}

function beams(r: Random, w: number, h: number, colors: readonly string[]) {
  let defs = "";
  let shapes = "";
  const sources = r.int(2, 4);
  let i = 0;
  for (let sIdx = 0; sIdx < sources; sIdx++) {
    const x = ((sIdx + 0.5) / sources + r.float(-0.08, 0.08)) * w;
    const y = r.float(0.02, 0.12) * h;
    const c = r.pick(colors.slice(0, 2));
    for (let k = 0; k < r.int(2, 3); k++, i++) {
      const id = `b${i}`;
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.08" stop-color="${c}" stop-opacity="0.8"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
      const spread = r.float(0.03, 0.1) * w;
      const tilt = r.float(-0.5, 0.5) * w;
      shapes += `<polygon points="${x},${y} ${x + tilt - spread},${h} ${x + tilt + spread},${h}" fill="url(#${id})" opacity="${r.float(0.3, 0.65).toFixed(2)}"/>`;
    }
    shapes += `<circle cx="${x}" cy="${y}" r="${(w * 0.012).toFixed(0)}" fill="#fff" opacity="0.95"/>`;
  }
  return { defs, shapes };
}

function bokeh(r: Random, w: number, h: number, colors: readonly string[]) {
  let s = "";
  for (let i = 0; i < r.int(12, 40); i++) {
    s += `<circle cx="${(r.next() * w).toFixed(0)}" cy="${(r.next() * h * 0.8).toFixed(0)}" r="${r.float(2, 22).toFixed(1)}" fill="${r.pick(colors.slice(0, 2))}" opacity="${r.float(0.1, 0.6).toFixed(2)}"/>`;
  }
  return s;
}

function crowd(r: Random, w: number, h: number) {
  let s = "";
  const base = h * r.float(0.84, 0.9);
  for (let row = 0; row < 2; row++) {
    const y0 = base + row * h * 0.06;
    const shade = row === 0 ? "#07060b" : "#030305";
    let x = -20;
    while (x < w + 20) {
      const size = r.float(0.018, 0.028) * Math.max(w, h * 0.7) * (1 + row * 0.3);
      const yy = y0 + r.float(-0.4, 0.4) * size;
      const headY = yy - size * r.float(1.25, 1.5);
      s += `<ellipse cx="${x.toFixed(0)}" cy="${(yy + size * 1.4).toFixed(0)}" rx="${(size * 1.7).toFixed(0)}" ry="${(size * 2.1).toFixed(0)}" fill="${shade}"/>`;
      s += `<ellipse cx="${x.toFixed(0)}" cy="${headY.toFixed(0)}" rx="${(size * 0.62).toFixed(0)}" ry="${(size * 0.75).toFixed(0)}" fill="${shade}"/>`;
      if (r.chance(0.22)) {
        const side = r.chance(0.5) ? 1 : -1;
        const armX = x + side * size * 1.2;
        s += `<line x1="${armX.toFixed(0)}" y1="${(yy - size * 0.1).toFixed(0)}" x2="${(armX + side * size * r.float(0.3, 1.2)).toFixed(0)}" y2="${(headY - size * r.float(2, 3.4)).toFixed(0)}" stroke="${shade}" stroke-width="${(size * 0.3).toFixed(0)}" stroke-linecap="round"/>`;
      }
      x += size * r.float(1.6, 2.4);
    }
  }
  s += `<rect x="0" y="${(base + h * 0.1).toFixed(0)}" width="${w}" height="${h}" fill="#030305"/>`;
  return s;
}

export interface ArtOptions {
  width: number;
  height: number;
  seed: string;
  crowd?: boolean;
  beams?: boolean;
}

export function artSvg(o: ArtOptions): string {
  const r = createRandom(hashString(o.seed));
  const colors = PALETTES[r.int(0, PALETTES.length - 1)]!;
  const { width: w, height: h } = o;
  const b = blobs(r, w, h, colors);
  const bm = o.beams === false ? { defs: "", shapes: "" } : beams(r, w, h, colors);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>${b.defs}${bm.defs}<filter id="blur"><feGaussianBlur stdDeviation="${(w / 60).toFixed(0)}"/></filter><filter id="soft"><feGaussianBlur stdDeviation="${(w / 300).toFixed(1)}"/></filter>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></linearGradient></defs>
<rect width="100%" height="100%" fill="${colors[2]}"/>
<g>${b.shapes}</g>
<g filter="url(#soft)">${bm.shapes}</g>
<g filter="url(#blur)" opacity="0.8">${bokeh(r, w, h, colors)}</g>
${bokeh(r, w, h, colors)}
${o.crowd === false ? "" : crowd(r, w, h)}
<rect width="100%" height="100%" fill="url(#fade)"/>
</svg>`;
}

/** Renders artwork to a JPEG buffer (then fed through the normal upload pipeline). */
export async function renderArt(o: ArtOptions): Promise<Buffer> {
  const svg = Buffer.from(artSvg(o));
  const noise = await sharp({
    create: { width: o.width, height: o.height, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 18 } },
  })
    .png()
    .toBuffer();
  return sharp(svg)
    .composite([{ input: noise, blend: "soft-light" }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export function avatarSvg(seed: string): string {
  const r = createRandom(hashString(seed));
  const c = PALETTES[r.int(0, PALETTES.length - 1)]!;
  const angle = r.int(0, 360);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
<defs><linearGradient id="a" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>
<filter id="f"><feGaussianBlur stdDeviation="30"/></filter></defs>
<rect width="400" height="400" fill="url(#a)"/>
<circle cx="${r.int(80, 320)}" cy="${r.int(80, 320)}" r="${r.int(90, 160)}" fill="${c[2]}" opacity="0.55" filter="url(#f)"/>
<circle cx="200" cy="165" r="70" fill="#000" opacity="0.28"/>
<ellipse cx="200" cy="380" rx="140" ry="130" fill="#000" opacity="0.28"/>
</svg>`;
}

export async function renderAvatar(seed: string): Promise<Buffer> {
  return sharp(Buffer.from(avatarSvg(seed))).jpeg({ quality: 90 }).toBuffer();
}

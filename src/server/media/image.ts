import "server-only";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { storage } from "../storage";
import { badRequest } from "../errors";
import { IMAGE_VARIANT_WIDTH } from "@/lib/media";

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "heif"]);
const MAX_INPUT_PIXELS = 60_000_000;

export interface StoredImage {
  key: string;
  width: number;
  height: number;
  blurDataUrl: string;
}

export function newMediaKey(prefix: "img" | "vid"): string {
  const id = randomBytes(12).toString("hex");
  return `${prefix}/${id.slice(0, 2)}/${id}`;
}

/**
 * Validates an uploaded image by decoding it (never trusting the declared
 * MIME type), auto-rotates it, strips all metadata (incl. GPS) and stores
 * WebP variants plus a tiny blur placeholder.
 */
export async function processImage(input: Buffer, opts: { square?: boolean } = {}): Promise<StoredImage> {
  let meta: { format?: string };
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw badRequest("El archivo no es una imagen válida");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw badRequest("Formato no soportado. Usa JPG, PNG, WebP o AVIF");
  }

  const key = newMediaKey("img");
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, pages: 1 }).rotate();

  let width = 0;
  let height = 0;
  for (const [variant, maxWidth] of Object.entries(IMAGE_VARIANT_WIDTH)) {
    const pipeline = base.clone();
    if (opts.square) pipeline.resize(maxWidth, maxWidth, { fit: "cover", position: "attention" });
    else pipeline.resize({ width: maxWidth, height: maxWidth * 2, fit: "inside", withoutEnlargement: true });
    const { data, info } = await pipeline.webp({ quality: variant === "sm" ? 72 : 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    await storage.put(`${key}_${variant}.webp`, data);
    if (variant === "lg") {
      width = info.width;
      height = info.height;
    }
  }

  const blur = await base.clone().resize(12, 12, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  return { key, width, height, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}` };
}

export async function deleteImage(key: string) {
  await storage.delete([`${key}_sm.webp`, `${key}_lg.webp`]);
}

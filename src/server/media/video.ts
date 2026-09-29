import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { storage } from "../storage";
import { badRequest } from "../errors";
import { newMediaKey, processImage } from "./image";

const run = promisify(execFile);
// Resolve from the project root: `import.meta.url` points inside the build
// output once Next.js bundles this module.
const require = createRequire(path.join(process.cwd(), "package.json"));

export const MAX_VIDEO_SECONDS = 90;

function binary(pkg: string): string | null {
  try {
    return (require(pkg) as { path: string }).path;
  } catch (err) {
    console.warn(`[media] ${pkg} not available — videos will be stored without transcoding`, (err as Error).message);
    return null;
  }
}

export const ffmpegPath = () => process.env.FFMPEG_PATH || binary("@ffmpeg-installer/ffmpeg");
export const ffprobePath = () => process.env.FFPROBE_PATH || binary("@ffprobe-installer/ffprobe");

/** Container sniffing by magic bytes (MP4/MOV "ftyp" box, WebM/Matroska EBML). */
export function sniffVideo(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length < 12) return null;
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return "webm";
  return null;
}

export interface StoredVideo {
  key: string;
  posterKey: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sizeBytes: number;
}

interface ProbeResult {
  streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  format?: { duration?: string };
}

/**
 * Validates and normalises a video for the vertical feed: H.264/AAC MP4,
 * max 720 px wide, CRF compression, `faststart` so playback begins before
 * the whole file downloads, plus a WebP poster frame.
 *
 * Runs inline for the MVP; move to a job queue when upload volume grows.
 */
export async function processVideo(input: Buffer): Promise<StoredVideo> {
  const container = sniffVideo(input);
  if (!container) throw badRequest("Formato de vídeo no soportado. Usa MP4, MOV o WebM");

  const ffmpeg = ffmpegPath();
  const ffprobe = ffprobePath();
  const key = newMediaKey("vid");

  if (!ffmpeg || !ffprobe) {
    // No transcoder available: store the original (already validated container).
    const ext = container === "mp4" ? "mp4" : "webm";
    await storage.put(`${key}.${ext}`, input);
    return { key: `${key}.${ext}`, posterKey: null, width: null, height: null, durationSec: null, sizeBytes: input.length };
  }

  const dir = await mkdtemp(path.join(tmpdir(), "nightly-vid-"));
  try {
    const src = path.join(dir, `in.${container}`);
    const out = path.join(dir, "out.mp4");
    const poster = path.join(dir, "poster.jpg");
    await writeFile(src, input);

    let probe: ProbeResult;
    try {
      const { stdout } = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", src], { timeout: 20_000 });
      probe = JSON.parse(stdout) as ProbeResult;
    } catch {
      throw badRequest("No se ha podido leer el vídeo");
    }
    const videoStream = probe.streams?.find((s) => s.codec_type === "video");
    if (!videoStream) throw badRequest("El archivo no contiene vídeo");
    const duration = Number(probe.format?.duration ?? 0);
    if (duration > MAX_VIDEO_SECONDS + 1) throw badRequest(`El vídeo puede durar como máximo ${MAX_VIDEO_SECONDS} s`);

    const hasAudio = probe.streams?.some((s) => s.codec_type === "audio");
    await run(
      ffmpeg,
      [
        "-y", "-i", src,
        "-t", String(MAX_VIDEO_SECONDS),
        "-vf", "scale='min(720,iw)':-2,fps=30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-profile:v", "high", "-pix_fmt", "yuv420p",
        ...(hasAudio ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]),
        "-movflags", "+faststart",
        "-map_metadata", "-1",
        out,
      ],
      { timeout: 180_000 },
    );
    await run(ffmpeg, ["-y", "-ss", String(Math.min(0.5, duration / 2)), "-i", out, "-frames:v", "1", "-q:v", "3", poster], { timeout: 30_000 });

    const { stdout: outProbe } = await run(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-print_format", "json", out]);
    const dims = (JSON.parse(outProbe) as ProbeResult).streams?.[0];
    const posterImage = await processImage(await readFile(poster));
    const size = (await stat(out)).size;
    await storage.putFile(`${key}.mp4`, out);

    return {
      key: `${key}.mp4`,
      posterKey: posterImage.key,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      durationSec: duration || null,
      sizeBytes: size,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

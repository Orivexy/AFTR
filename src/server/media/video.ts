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

export interface ProbeResult {
  hasVideo: boolean;
  hasAudio: boolean;
  durationSec: number | null;
  width: number | null;
  height: number | null;
}

/**
 * Reads what `ffmpeg -i <file>` prints about the input (no ffprobe needed,
 * which saves ~80 MB in the desktop apps):
 *   Duration: 00:00:12.34, start: …
 *   Stream #0:0[0x1](und): Video: h264 (High) (avc1 / …), yuv420p(tv, …), 1080x1920 [SAR 1:1 DAR 9:16], …
 *   Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / …), 44100 Hz, stereo, …
 */
export function parseFfmpegInfo(stderr: string): ProbeResult {
  const streams = stderr.split("\n").filter((l) => /^\s*Stream #\d+:\d+/.test(l));
  const video = streams.find((l) => /: Video: /.test(l) && !/attached pic/.test(l));
  const dims = video?.match(/, (\d{2,5})x(\d{2,5})[\s,]/);
  const d = stderr.match(/Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  return {
    hasVideo: Boolean(video),
    hasAudio: streams.some((l) => /: Audio: /.test(l)),
    durationSec: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null,
    width: dims ? Number(dims[1]) : null,
    height: dims ? Number(dims[2]) : null,
  };
}

async function probe(ffmpeg: string, file: string): Promise<ProbeResult> {
  // `ffmpeg -i` without an output exits with code 1 after printing the input info.
  const stderr = await new Promise<string>((resolve) => {
    execFile(ffmpeg, ["-hide_banner", "-i", file], { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 }, (_err, _out, err) => resolve(String(err ?? "")));
  });
  return parseFfmpegInfo(stderr);
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
  const key = newMediaKey("vid");

  if (!ffmpeg) {
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

    const info = await probe(ffmpeg, src);
    if (!info.hasVideo) throw badRequest("No se ha podido leer el vídeo o no contiene imagen");
    const duration = info.durationSec ?? 0;
    if (duration > MAX_VIDEO_SECONDS + 1) throw badRequest(`El vídeo puede durar como máximo ${MAX_VIDEO_SECONDS} s`);

    const hasAudio = info.hasAudio;
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

    const dims = await probe(ffmpeg, out);
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

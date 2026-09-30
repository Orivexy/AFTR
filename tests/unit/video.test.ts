import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DATABASE_URL ??= "postgresql://test@localhost:5432/test"; // env is validated on import; nothing connects
const { parseFfmpegInfo, sniffVideo } = await import("@/server/media/video");

describe("ffmpeg input info", () => {
  it("reads duration, size and audio", () => {
    const info = parseFfmpegInfo(`Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'in.mp4':
  Duration: 00:01:02.50, start: 0.000000, bitrate: 4567 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1080x1920 [SAR 1:1 DAR 9:16], 4400 kb/s, 30 fps
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s
At least one output file must be specified`);
    expect(info).toEqual({ hasVideo: true, hasAudio: true, durationSec: 62.5, width: 1080, height: 1920 });
  });

  it("treats cover art as no video and rejects garbage", () => {
    expect(parseFfmpegInfo(`  Duration: 00:03:00.00\n  Stream #0:0: Audio: mp3, 44100 Hz\n  Stream #0:1: Video: mjpeg, yuvj420p, 600x600, 90k tbn (attached pic)`).hasVideo).toBe(false);
    expect(parseFfmpegInfo("in.mp4: Invalid data found when processing input")).toMatchObject({ hasVideo: false, durationSec: null });
  });

  it("sniffs containers by magic bytes", () => {
    expect(sniffVideo(Buffer.from("0000ftypisom0000", "latin1"))).toBe("mp4");
    expect(sniffVideo(Buffer.from("<html>hello world</html>"))).toBeNull();
  });
});

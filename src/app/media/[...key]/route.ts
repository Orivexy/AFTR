import { contentTypeFor, storage } from "@/server/storage";

/**
 * Serves stored media. Keys are random and content never changes, so
 * responses are immutable-cacheable. Supports HTTP Range for video seeking
 * (required by Safari/iOS). With a public bucket / CDN (S3_PUBLIC_URL) it
 * redirects there instead of proxying the bytes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const type = contentTypeFor(key);
  if (!type) return new Response("Not found", { status: 404 });

  const direct = storage.publicUrl(key);
  if (direct) return new Response(null, { status: 308, headers: { Location: direct, "Cache-Control": "public, max-age=31536000, immutable" } });

  let info;
  try {
    info = await storage.stat(key);
  } catch (err) {
    if (!(err as Error).message.startsWith("Invalid storage key")) console.error("[media]", (err as Error).message);
    return new Response("Not found", { status: 404 });
  }
  if (!info) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };

  try {
    const range = req.headers.get("range");
    const m = range?.match(/^bytes=(\d*)-(\d*)$/);
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : info.size - Number(m[2]);
      let end = m[1] && m[2] ? Number(m[2]) : info.size - 1;
      start = Math.max(0, start);
      end = Math.min(end, info.size - 1);
      if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      return new Response(await storage.read(key, { start, end }), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
      });
    }
    return new Response(await storage.read(key), { headers: { ...headers, "Content-Length": String(info.size) } });
  } catch (err) {
    console.error("[media]", (err as Error).message);
    return new Response("Storage unavailable", { status: 502 });
  }
}

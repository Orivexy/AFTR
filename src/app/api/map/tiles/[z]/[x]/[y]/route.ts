import { upstreamTileUrl } from "@/server/services/map";

/**
 * Tile proxy for keyed map providers: the API key stays on the server and
 * tiles are cached by the browser / CDN for a day.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const p = await params;
  const [z, x, y] = [p.z, p.x, p.y].map((v) => Number.parseInt(v, 10));
  if (![z, x, y].every((n) => Number.isInteger(n) && n! >= 0) || z! > 20) return new Response("Bad tile", { status: 400 });
  const url = upstreamTileUrl(z!, x!, y!);
  if (!url) return new Response("Map provider not configured", { status: 404 });
  const upstream = await fetch(url, { next: { revalidate: 86400 } });
  if (!upstream.ok) return new Response("Tile unavailable", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

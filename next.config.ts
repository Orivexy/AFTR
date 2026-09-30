import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");

/** Tile hosts the map may load directly (keyless providers only). */
const MAP_TILE_HOSTS = "https://*.basemaps.cartocdn.com";
/** Vector map: style, tiles, fonts and sprites (OpenFreeMap by default, MAP_STYLE_URL to change). */
const MAP_VECTOR_HOSTS = (() => {
  try {
    const origin = new URL(process.env.MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty").origin;
    return origin === "https://tiles.openfreemap.org" ? ` ${origin}` : ` ${origin} https://tiles.openfreemap.org`;
  } catch {
    return " https://tiles.openfreemap.org";
  }
})();

/** Media CDN / public bucket (S3_PUBLIC_URL), if any. Read at build time. */
const MEDIA_ORIGIN = (() => {
  try {
    return process.env.S3_PUBLIC_URL ? ` ${new URL(process.env.S3_PUBLIC_URL).origin}` : "";
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_TILE_HOSTS}${MAP_VECTOR_HOSTS}${MEDIA_ORIGIN}`,
  `media-src 'self' blob:${MEDIA_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self'${MAP_VECTOR_HOSTS}${isDev ? " ws: wss:" : ""}`,
  // MapLibre renders tiles in a Web Worker created from a blob.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  ...(isDev || !isHttps ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Self-contained server bundle for the desktop (Windows) build.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  agentRules: false,
  devIndicators: false,
  compress: true,
  serverExternalPackages: ["sharp", "@ffmpeg-installer/ffmpeg", "bcryptjs"],
  images: {
    // Uploaded media is pre-optimised into fixed variants at upload time;
    // see src/lib/media-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/media-loader.ts",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");

/** Tile hosts the map may load directly (keyless providers only). */
const MAP_TILE_HOSTS = "https://*.basemaps.cartocdn.com";

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
  `img-src 'self' data: blob: ${MAP_TILE_HOSTS}${MEDIA_ORIGIN}`,
  `media-src 'self' blob:${MEDIA_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
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

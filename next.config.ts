import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Tile hosts the map may load directly (keyless providers only). */
const MAP_TILE_HOSTS = "https://*.basemaps.cartocdn.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_TILE_HOSTS}`,
  "media-src 'self' blob:",
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
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  compress: true,
  serverExternalPackages: ["sharp", "@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe", "bcryptjs"],
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

import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Validated once at startup; never import this
 * from client components (the `server-only` import enforces it).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  EVENT_MODERATION: z.enum(["off", "new_users", "all"]).default("new_users"),
  AUTO_HIDE_REPORT_THRESHOLD: z.coerce.number().int().min(1).default(5),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  // S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2…).
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("auto"),
  // Custom endpoint for non-AWS providers, e.g. https://<account>.r2.cloudflarestorage.com
  S3_ENDPOINT: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  // Optional public base URL (CDN / public bucket): /media redirects there instead of proxying.
  S3_PUBLIC_URL: z.string().optional().default(""),
  MAX_IMAGE_MB: z.coerce.number().positive().default(12),
  MAX_VIDEO_MB: z.coerce.number().positive().default(80),
  MAP_PROVIDER: z.enum(["carto", "mapbox", "maptiler"]).default("carto"),
  MAPBOX_TOKEN: z.string().optional().default(""),
  MAPTILER_KEY: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  // Transactional email (password reset). SMTP URL: smtps://user:pass@smtp.example.com:465
  SMTP_URL: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default(""),
  // Event discovery (see docs/event-discovery.md)
  DISCOVERY_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  EVENT_SYNC_INTERVAL: z.string().default("30m"),
  DISCOVERY_ALLOW_PRIVATE_HOSTS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),
  TICKETMASTER_API_KEY: z.string().optional().default(""),
  // Places & sync jobs (see docs/places-and-map.md)
  VENUE_SYNC_INTERVAL: z.string().default("24h"),
  VENUE_HOURS_SYNC_INTERVAL: z.string().default("12h"),
  OVERPASS_API_URL: z.url().default("https://overpass-api.de/api/interpreter"),
  // Address search (OpenStreetMap Nominatim, no key; max 1 request/second by policy).
  NOMINATIM_URL: z.url().default("https://nominatim.openstreetmap.org"),
  // Daily request caps per provider (cost / fair-use protection).
  OVERPASS_DAILY_LIMIT: z.coerce.number().int().min(0).default(200),
  NOMINATIM_DAILY_LIMIT: z.coerce.number().int().min(0).default(1000),
  GOOGLE_PLACES_DAILY_LIMIT: z.coerce.number().int().min(0).default(150),
  TICKETMASTER_DAILY_LIMIT: z.coerce.number().int().min(0).default(1000),
  // Optional: your contracted price per 1000 Google Places requests, to estimate cost in /admin.
  GOOGLE_PLACES_COST_PER_1000: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).optional()),
  // Set by the desktop app (Windows/Mac/Linux) for its local server.
  DESKTOP_APP: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  // Desktop app only: the first registered account becomes ADMIN. Never enable on a public site.
  FIRST_USER_IS_ADMIN: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ENABLE_INPROCESS_JOBS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export const env = schema.parse(process.env);

export const isProd = env.NODE_ENV === "production";

/**
 * Secure cookies only when served over HTTPS. The desktop build serves the
 * app over plain HTTP on the local network (for testing from phones).
 */
export const useSecureCookies = env.APP_URL.startsWith("https://");

export const features = {
  googleAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  email: Boolean(env.SMTP_URL && env.EMAIL_FROM),
};

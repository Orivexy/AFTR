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
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  MAX_IMAGE_MB: z.coerce.number().positive().default(12),
  MAX_VIDEO_MB: z.coerce.number().positive().default(80),
  MAP_PROVIDER: z.enum(["carto", "mapbox", "maptiler"]).default("carto"),
  MAPBOX_TOKEN: z.string().optional().default(""),
  MAPTILER_KEY: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  // Event discovery (see docs/event-discovery.md)
  DISCOVERY_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  EVENT_SYNC_INTERVAL: z.string().default("30m"),
  DISCOVERY_ALLOW_PRIVATE_HOSTS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),
  TICKETMASTER_API_KEY: z.string().optional().default(""),
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
};

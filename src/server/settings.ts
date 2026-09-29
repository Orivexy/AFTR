import "server-only";
import { z } from "zod";
import { db } from "./db";
import { env } from "./env";

/**
 * Runtime settings, editable by admins in /admin/settings and stored in
 * AppSetting. Environment variables are the defaults. Values are cached for
 * a few seconds per server instance.
 */
export const SETTINGS_SCHEMA = z.object({
  eventModeration: z.enum(["off", "new_users", "all"]),
  autoHideReportThreshold: z.number().int().min(1).max(100),
  registrationsOpen: z.boolean(),
  discoveryEnabled: z.boolean(),
});
export type AppSettings = z.infer<typeof SETTINGS_SCHEMA>;

export const defaultSettings = (): AppSettings => ({
  eventModeration: env.EVENT_MODERATION,
  autoHideReportThreshold: env.AUTO_HIDE_REPORT_THRESHOLD,
  registrationsOpen: true,
  discoveryEnabled: env.DISCOVERY_ENABLED,
});

let cache: { at: number; value: AppSettings } | null = null;
const TTL_MS = 5_000;

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await db.appSetting.findMany();
  const merged: Record<string, unknown> = { ...defaultSettings() };
  for (const r of rows) if (r.key in merged) merged[r.key] = r.value;
  const parsed = SETTINGS_SCHEMA.safeParse(merged);
  const value = parsed.success ? parsed.data : defaultSettings();
  cache = { at: Date.now(), value };
  return value;
}

export async function updateSettings(patch: Partial<AppSettings>, adminId: string) {
  const valid = SETTINGS_SCHEMA.partial().parse(patch);
  await db.$transaction(
    Object.entries(valid).map(([key, value]) =>
      db.appSetting.upsert({ where: { key }, create: { key, value: value as never, updatedById: adminId }, update: { value: value as never, updatedById: adminId } }),
    ),
  );
  cache = null;
  return getSettings();
}

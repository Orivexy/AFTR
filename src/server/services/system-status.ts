import "server-only";
import { db } from "../db";
import { env, features, isProd } from "../env";
import { storageStatus } from "../storage";
import { ffmpegPath, ffprobePath } from "../media/video";
import { monetizationFlags } from "../monetization/flags";

export type ServiceState = "ok" | "off" | "warn" | "error";
export interface ServiceStatus {
  name: string;
  state: ServiceState;
  detail: string;
  /** What to configure to enable / fix it (env var names, never values). */
  fix?: string;
}

/** Configuration and health of every external dependency, for /admin/settings. */
export async function systemStatus(): Promise<ServiceStatus[]> {
  const out: ServiceStatus[] = [];

  try {
    const [{ version }] = await db.$queryRaw<Array<{ version: string }>>`SELECT split_part(version(), ' ', 2) AS version`;
    const [{ count }] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    out.push({ name: "Base de datos", state: "ok", detail: `PostgreSQL ${version} · ${count} migraciones aplicadas` });
  } catch (err) {
    out.push({ name: "Base de datos", state: "error", detail: (err as Error).message.slice(0, 200) });
  }

  out.push({
    name: "URL pública",
    state: env.APP_URL.startsWith("https://") ? "ok" : isProd ? "warn" : "off",
    detail: env.APP_URL,
    fix: env.APP_URL.startsWith("https://") ? undefined : "En producción APP_URL debe ser https:// (cookies seguras, OAuth, enlaces de email).",
  });

  out.push(
    features.email
      ? { name: "Email (recuperar contraseña)", state: "ok", detail: `SMTP configurado · remitente ${env.EMAIL_FROM}` }
      : { name: "Email (recuperar contraseña)", state: isProd ? "warn" : "off", detail: "Sin SMTP: la recuperación de contraseña muestra que no está disponible.", fix: "SMTP_URL y EMAIL_FROM" },
  );

  out.push(
    features.googleAuth
      ? { name: "Login con Google", state: "ok", detail: `Callback: ${env.APP_URL}/api/auth/oauth/google/callback` }
      : { name: "Login con Google", state: "off", detail: "El botón no se muestra.", fix: "GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET" },
  );

  const s = storageStatus();
  out.push({
    name: "Almacenamiento de archivos",
    state: s.configured ? "ok" : "error",
    detail: s.driver === "s3" ? `S3 · ${s.detail}${env.S3_PUBLIC_URL ? " · CDN pública" : ""}` : `Disco local · ${s.detail}`,
    fix: s.configured ? (s.driver === "local" && isProd ? "Con varias instancias o sin disco persistente usa STORAGE_DRIVER=s3." : undefined) : `Falta: ${s.missing.join(", ")}`,
  });

  const video = Boolean(ffmpegPath() && ffprobePath());
  out.push({ name: "Procesado de vídeo", state: video ? "ok" : "warn", detail: video ? "ffmpeg disponible" : "Sin ffmpeg: los vídeos MP4/WebM se guardan sin transcodificar.", fix: video ? undefined : "FFMPEG_PATH y FFPROBE_PATH" });

  const keyed = env.MAP_PROVIDER !== "carto";
  const mapKey = env.MAP_PROVIDER === "mapbox" ? env.MAPBOX_TOKEN : env.MAP_PROVIDER === "maptiler" ? env.MAPTILER_KEY : "n/a";
  out.push({
    name: "Mapas",
    state: !keyed || mapKey ? "ok" : "error",
    detail: keyed ? `${env.MAP_PROVIDER} (teselas vía proxy del servidor)` : "CARTO (sin clave)",
    fix: keyed && !mapKey ? (env.MAP_PROVIDER === "mapbox" ? "MAPBOX_TOKEN" : "MAPTILER_KEY") : undefined,
  });

  out.push({ name: "OpenStreetMap (locales y horarios)", state: "ok", detail: `Sin clave · límite ${env.OVERPASS_DAILY_LIMIT} peticiones/día` });
  out.push(
    env.TICKETMASTER_API_KEY
      ? { name: "Ticketmaster (eventos)", state: "ok", detail: `Clave configurada · límite ${env.TICKETMASTER_DAILY_LIMIT}/día` }
      : { name: "Ticketmaster (eventos)", state: "off", detail: "Las fuentes de Ticketmaster no se ejecutan.", fix: "TICKETMASTER_API_KEY" },
  );
  out.push(
    env.GOOGLE_PLACES_API_KEY
      ? { name: "Google Places (vincular locales)", state: "ok", detail: `Clave configurada · límite ${env.GOOGLE_PLACES_DAILY_LIMIT}/día` }
      : { name: "Google Places (vincular locales)", state: "off", detail: "Opcional: solo vincula IDs y detecta cierres.", fix: "GOOGLE_PLACES_API_KEY" },
  );

  const jobs = await db.syncJob.findMany({ select: { name: true, lastRunAt: true, status: true } });
  const lastRun = jobs.reduce<Date | null>((a, j) => (j.lastRunAt && (!a || j.lastRunAt > a) ? j.lastRunAt : a), null);
  const stale = !lastRun || Date.now() - lastRun.getTime() > 26 * 3600_000;
  out.push({
    name: "Tareas periódicas",
    state: stale ? "warn" : "ok",
    detail: `${env.ENABLE_INPROCESS_JOBS ? "En el proceso del servidor" : "Cron externo"} · última ejecución de sincronización: ${lastRun ? lastRun.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "nunca"}`,
    fix: stale ? (env.ENABLE_INPROCESS_JOBS ? "Comprueba los logs del servidor." : "Programa POST /api/cron/<tarea> con Authorization: Bearer $CRON_SECRET (ver docs/deployment.md).") : undefined,
  });
  out.push({
    name: "Endpoint de cron",
    state: env.CRON_SECRET && env.CRON_SECRET !== "change-me" ? "ok" : env.ENABLE_INPROCESS_JOBS ? "off" : "error",
    detail: env.CRON_SECRET && env.CRON_SECRET !== "change-me" ? "Protegido con CRON_SECRET" : "Sin secreto válido: /api/cron rechaza todas las llamadas.",
    fix: env.CRON_SECRET && env.CRON_SECRET !== "change-me" ? undefined : "CRON_SECRET (valor aleatorio largo)",
  });

  out.push({ name: "Monetización", state: monetizationFlags.master ? "ok" : "off", detail: monetizationFlags.master ? "Activada (ver Monetización)" : "Desactivada: NIVEX es gratis.", fix: monetizationFlags.master ? undefined : "MONETIZATION_ENABLED + flags (docs/monetization.md)" });
  return out;
}

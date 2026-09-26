import { z } from "zod";
import { route, parseJson, notFound } from "@/server/http";
import { db } from "@/server/db";
import { SYNC_JOB_NAMES, runSyncJob, type SyncJobName } from "@/server/sync/jobs";

export const maxDuration = 300;

function jobName(name: string): SyncJobName {
  if (!(SYNC_JOB_NAMES as string[]).includes(name)) throw notFound("Job desconocido");
  return name as SyncJobName;
}

/** Run a sync job now (ignores its schedule and backoff). */
export const POST = route<{ name: string }>({ auth: "admin", audit: { action: "sync.job.run", targetType: "SYNC_JOB" } }, async ({ params }) => {
  return runSyncJob(jobName(params.name), { force: true });
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  /** Minutes; null = default from env. */
  intervalMin: z.number().int().min(5).max(7 * 24 * 60).nullable().optional(),
});

export const PATCH = route<{ name: string }>({ auth: "admin", audit: { action: "sync.job.update", targetType: "SYNC_JOB" } }, async ({ req, params }) => {
  const name = jobName(params.name);
  const data = await parseJson(req, updateSchema);
  await db.syncJob.upsert({ where: { name }, create: { name, ...data }, update: { ...data, ...(data.enabled ? { nextRunAt: new Date(), consecutiveFailures: 0 } : {}) } });
  return { ok: true };
});

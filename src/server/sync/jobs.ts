import "server-only";
import { getSettings } from "../settings";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { parseDurationMinutes } from "@/lib/duration";
import { runDueSources, type DueRunResult } from "../discovery/engine";
import { backoffMinutes } from "../places/rules";

/**
 * VENUE_SYNC · EVENT_SYNC · VENUE_HOURS_SYNC
 *
 * Each job has a configurable interval (env, overridable per job in the DB),
 * a lease so it never runs twice at once, a SyncRun log per run, last
 * success / failure timestamps and exponential backoff after failures (it
 * never loops on a broken API). Inside, every source keeps its own schedule
 * and backoff. Nothing here runs on page views: the app reads the database.
 */
export const SYNC_JOBS = {
  VENUE_SYNC: {
    label: "Locales (descubrimiento y datos)",
    defaultInterval: () => parseDurationMinutes(env.VENUE_SYNC_INTERVAL, 24 * 60),
    run: (force: boolean) => runDueSources("venues", { force, job: "VENUE_SYNC" }),
  },
  EVENT_SYNC: {
    label: "Eventos",
    defaultInterval: () => parseDurationMinutes(env.EVENT_SYNC_INTERVAL, 30),
    run: (force: boolean) => runDueSources("events", { force, job: "EVENT_SYNC" }),
  },
  VENUE_HOURS_SYNC: {
    label: "Horarios de locales",
    defaultInterval: () => parseDurationMinutes(env.VENUE_HOURS_SYNC_INTERVAL, 12 * 60),
    run: (force: boolean) => runDueSources("venues", { force, mode: "hours", job: "VENUE_HOURS_SYNC" }),
  },
} as const;

export type SyncJobName = keyof typeof SYNC_JOBS;
export const SYNC_JOB_NAMES = Object.keys(SYNC_JOBS) as SyncJobName[];

const LEASE_MINUTES = 60;

export function jobInterval(name: SyncJobName, override: number | null | undefined) {
  return Math.max(5, override ?? SYNC_JOBS[name].defaultInterval());
}

async function ensureJob(name: SyncJobName) {
  return db.syncJob.upsert({ where: { name }, create: { name }, update: {} });
}

export type JobOutcome = { skipped: string } | { ok: boolean; result: DueRunResult };

/** Runs a job if it is due (or `force`), with lease, logging and backoff. */
export async function runSyncJob(name: SyncJobName, { force = false } = {}): Promise<JobOutcome> {
  if (!(await getSettings()).discoveryEnabled) return { skipped: "sincronización desactivada en los ajustes" };
  const job = await ensureJob(name);
  const now = new Date();
  if (!job.enabled && !force) return { skipped: "desactivado" };
  if (!force && job.nextRunAt && job.nextRunAt > now) return { skipped: "no toca todavía" };

  const { count } = await db.syncJob.updateMany({
    where: { name, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { status: "RUNNING", lockedUntil: new Date(now.getTime() + LEASE_MINUTES * 60_000), lastRunAt: now },
  });
  if (count !== 1) return { skipped: "ya se está ejecutando" };

  const run = await db.syncRun.create({ data: { job: name, status: "RUNNING" } });
  let result: DueRunResult = { ran: 0, ok: 0, failed: 0, errors: [] };
  let error: string | null = null;
  try {
    result = await SYNC_JOBS[name].run(force);
    // Failed only when every source it tried failed (partial failures are logged per source).
    if (result.ran > 0 && result.ok === 0) error = result.errors.join(" · ").slice(0, 500) || "Todas las fuentes fallaron";
  } catch (err) {
    error = (err as Error).message.slice(0, 500);
  }

  const finishedAt = new Date();
  const failures = error ? job.consecutiveFailures + 1 : 0;
  const interval = jobInterval(name, job.intervalMin);
  await db.$transaction([
    db.syncRun.update({
      where: { id: run.id },
      data: {
        status: error ? "ERROR" : "OK",
        finishedAt,
        errors: result.failed,
        log: [
          `${result.ran} fuente(s) sincronizadas: ${result.ok} OK, ${result.failed} con error`,
          ...result.errors,
          ...(error && !result.errors.length ? [error] : []),
        ].join("\n"),
      },
    }),
    db.syncJob.update({
      where: { name },
      data: {
        status: error ? "ERROR" : "OK",
        lockedUntil: null,
        consecutiveFailures: failures,
        lastError: error,
        ...(error ? { lastFailureAt: finishedAt } : { lastSuccessAt: finishedAt }),
        nextRunAt: new Date(finishedAt.getTime() + backoffMinutes(interval, failures) * 60_000),
        lastResult: result as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  return { ok: !error, result };
}

export async function syncJobsOverview() {
  await Promise.all(SYNC_JOB_NAMES.map(ensureJob));
  const jobs = await db.syncJob.findMany({ where: { name: { in: SYNC_JOB_NAMES } } });
  return SYNC_JOB_NAMES.map((name) => {
    const j = jobs.find((x) => x.name === name)!;
    return { ...j, label: SYNC_JOBS[name].label, intervalMin: jobInterval(name, j.intervalMin), defaultIntervalMin: SYNC_JOBS[name].defaultInterval() };
  });
}

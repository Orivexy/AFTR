import "server-only";
import { sendEventReminders } from "../services/events";
import { cleanupOrphanUploads } from "../services/uploads";
import { endExpiredPromotions } from "../monetization/promotions";
import { purgeExpiredSourceData, runDueSources } from "../discovery/engine";

/**
 * Periodic jobs. Run in-process (see src/instrumentation.ts) for a single
 * instance, or call /api/cron/[job] from an external scheduler.
 */
export const JOBS = {
  "event-reminders": { everyMs: 5 * 60_000, run: () => sendEventReminders() },
  "cleanup-uploads": { everyMs: 60 * 60_000, run: () => cleanupOrphanUploads() },
  "end-promotions": { everyMs: 60 * 60_000, run: () => endExpiredPromotions() },
  // Checks every minute which sources are due (each has its own interval).
  "event-discovery": { everyMs: 60_000, run: () => runDueSources() },
  "discovery-maintenance": { everyMs: 24 * 60 * 60_000, run: () => purgeExpiredSourceData() },
} as const;

export type JobName = keyof typeof JOBS;

export function startInProcessJobs() {
  const g = globalThis as unknown as { __jobsStarted?: boolean };
  if (g.__jobsStarted) return;
  g.__jobsStarted = true;
  for (const [name, job] of Object.entries(JOBS)) {
    const tick = () => job.run().catch((err) => console.error(`[jobs] ${name} failed`, err));
    setTimeout(tick, 15_000);
    setInterval(tick, job.everyMs).unref();
  }
}

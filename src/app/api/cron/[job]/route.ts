import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { JOBS, type JobName } from "@/server/jobs";

/** External scheduler entry point: POST /api/cron/event-reminders with a Bearer secret. */
export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const secret = env.CRON_SECRET;
  const ok = secret.length > 0 && token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(job in JOBS)) return Response.json({ error: "unknown job" }, { status: 404 });
  const result = await JOBS[job as JobName].run();
  return Response.json({ ok: true, result });
}

import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { resolveReport } from "@/server/services/reports";

const body = z.object({
  action: z.enum(["dismiss", "remove", "restore", "suspend"]),
  note: z.string().max(300).optional(),
});

export const POST = route<{ id: string }>({ auth: "moderator", audit: { action: "report.resolve", targetType: "REPORT" } }, async ({ req, params, user }) => {
  const { action, note } = await parseJson(req, body);
  await resolveReport(params.id, user!.id, action, note);
  return { ok: true };
});

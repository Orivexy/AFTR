import { route, parseJson } from "@/server/http";
import { reportSchema } from "@/lib/validators";
import { createReport } from "@/server/services/reports";

export const POST = route({ auth: true, rateLimit: "report" }, async ({ req, user }) => {
  const input = await parseJson(req, reportSchema);
  return createReport(user!.id, input);
});

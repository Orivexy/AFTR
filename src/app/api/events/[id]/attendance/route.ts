import { route, parseJson } from "@/server/http";
import { attendanceSchema } from "@/lib/validators";
import { setAttendance } from "@/server/services/events";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { status } = await parseJson(req, attendanceSchema);
  return setAttendance(user!.id, params.id, status);
});

import { route } from "@/server/http";
import { destroyAllSessions, destroySession } from "@/server/auth/session";

/** Signs out this device, or every device with { everywhere: true }. */
export const POST = route({}, async ({ req, user }) => {
  const body = (await req.json().catch(() => ({}))) as { everywhere?: unknown };
  if (body.everywhere === true && user) await destroyAllSessions(user.id);
  await destroySession();
  return { ok: true };
});

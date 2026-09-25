import { route } from "@/server/http";
import { markAllRead } from "@/server/services/notifications";

export const POST = route({ auth: true }, async ({ user }) => {
  await markAllRead(user!.id);
  return { ok: true };
});

import { route, parseJson } from "@/server/http";
import { changePasswordSchema } from "@/lib/validators";
import { changePassword } from "@/server/auth/account";
import { createSession } from "@/server/auth/session";

/** Changes (or, for Google-only accounts, sets) the password; signs out other devices. */
export const PUT = route({ auth: true, rateLimit: "account", audit: { action: "auth.password.change", targetType: "USER" } }, async ({ req, user }) => {
  const { currentPassword, password } = await parseJson(req, changePasswordSchema);
  await changePassword(user!.id, currentPassword, password);
  await createSession(user!.id);
  return { ok: true };
});

import { cookies } from "next/headers";
import { route, parseJson } from "@/server/http";
import { deleteAccountSchema } from "@/lib/validators";
import { deleteAccount } from "@/server/auth/account";
import { SESSION_COOKIE } from "@/server/auth/session";

export const DELETE = route({ auth: true, rateLimit: "account", audit: { action: "auth.account.delete", targetType: "USER" } }, async ({ req, user }) => {
  const { confirm, password } = await parseJson(req, deleteAccountSchema);
  await deleteAccount(user!.id, confirm, password);
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
});

import { route, parseJson } from "@/server/http";
import { resetPasswordSchema } from "@/lib/validators";
import { resetPassword } from "@/server/auth/account";

export const POST = route({ rateLimit: "passwordReset", audit: { action: "auth.password.reset", targetType: "USER" } }, async ({ req }) => {
  const { token, password } = await parseJson(req, resetPasswordSchema);
  await resetPassword(token, password);
  return { ok: true };
});

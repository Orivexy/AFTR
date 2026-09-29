import { route, parseJson, ApiError } from "@/server/http";
import { forgotPasswordSchema } from "@/lib/validators";
import { requestPasswordReset } from "@/server/auth/account";
import { checkRateLimit } from "@/server/security/rate-limit";

/** Sends a reset link if the account exists (same answer either way). */
export const POST = route({ rateLimit: "passwordReset" }, async ({ req }) => {
  const { email } = await parseJson(req, forgotPasswordSchema);
  if (!checkRateLimit("passwordReset", `email:${email}`).ok) throw new ApiError(429, "Ya te hemos enviado varios enlaces. Espera un rato.", "RATE_LIMITED");
  await requestPasswordReset(email);
  return { ok: true };
});

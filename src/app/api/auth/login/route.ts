import { route, parseJson, ApiError } from "@/server/http";
import { loginSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { checkRateLimit } from "@/server/security/rate-limit";

const INVALID = "Email o contraseña incorrectos";

export const POST = route({ rateLimit: "auth" }, async ({ req }) => {
  const input = await parseJson(req, loginSchema);
  // Per-account limit on top of the per-IP one (credential stuffing).
  if (!checkRateLimit("auth", `email:${input.email}`).ok) {
    throw new ApiError(429, "Demasiados intentos. Espera unos minutos.", "RATE_LIMITED");
  }
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, status: true },
  });
  const valid = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !valid) throw new ApiError(401, INVALID, "INVALID_CREDENTIALS");
  if (user.status === "SUSPENDED") throw new ApiError(403, "Tu cuenta está suspendida", "SUSPENDED");
  await createSession(user.id);
  return { ok: true };
});

import { route, parseJson, badRequest, ApiError } from "@/server/http";
import { registerSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { createUserWithProfile } from "@/server/auth/users";
import { checkRateLimit } from "@/server/security/rate-limit";

export const POST = route({ rateLimit: "register" }, async ({ req }) => {
  const input = await parseJson(req, registerSchema);
  if (input.website) throw badRequest("Solicitud no válida"); // honeypot
  if (!checkRateLimit("authAccount", input.email).ok) throw new ApiError(429, "Demasiados intentos. Espera un momento.");

  const [emailTaken, usernameTaken] = await Promise.all([
    db.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    db.profile.findUnique({ where: { username: input.username }, select: { id: true } }),
  ]);
  if (emailTaken) throw badRequest("Ya existe una cuenta con ese email", { email: "Ya existe una cuenta con ese email" });
  if (usernameTaken) throw badRequest("Ese nombre de usuario ya existe", { username: "Ya está en uso" });

  const user = await createUserWithProfile({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    username: input.username,
    displayName: input.displayName,
  });
  await createSession(user.id);
  return { ok: true, username: input.username };
});

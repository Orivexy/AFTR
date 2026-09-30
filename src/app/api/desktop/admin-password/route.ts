import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/server/env";
import { setBootstrapAdminPassword } from "@/server/services/bootstrap-admin";

const bodySchema = z.object({ password: z.string().min(4).max(128) });

/**
 * Desktop app only: the owner of this computer picks the administrator's
 * password from the app menu (never stored in the repository). Authorised
 * with the install's own secret, which only the desktop process knows.
 */
export async function POST(req: Request) {
  if (!env.DESKTOP_APP) return Response.json({ error: "not found" }, { status: 404 });
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const secret = env.CRON_SECRET;
  if (!(secret.length > 0 && token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret)))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "La contraseña debe tener entre 4 y 128 caracteres" }, { status: 400 });
  return Response.json(await setBootstrapAdminPassword(parsed.data.password));
}

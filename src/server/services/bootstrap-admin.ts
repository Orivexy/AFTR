import "server-only";
import { db } from "../db";
import { env } from "../env";
import { hashPassword } from "../auth/password";
import { buildSearchText } from "@/lib/text";

/**
 * Desktop app: an administrator account with credentials generated on the
 * user's computer at first launch (never stored in the repository). Creates
 * it once; an existing account with that email only gets the ADMIN role, its
 * password is left alone (the user may have changed it).
 */
export async function ensureBootstrapAdmin() {
  const email = env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || password.length < 4) return { skipped: "sin credenciales" };

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role !== "ADMIN") await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" } });
    return { created: false, email };
  }
  let username = "admin";
  for (let i = 2; await db.profile.findUnique({ where: { username }, select: { id: true } }); i++) username = `admin${i}`;
  const city = await db.city.findFirst({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true } });
  await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      profile: { create: { username, displayName: "Administrador", searchText: buildSearchText(username, "Administrador"), cityId: city?.id } },
    },
  });
  return { created: true, email, username };
}

/** Sets the administrator's password chosen by the owner in the desktop app (creating the account if needed). */
export async function setBootstrapAdminPassword(password: string) {
  const email = env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  if (!email) throw new Error("Sin cuenta de administrador de escritorio");
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    await ensureBootstrapAdmin();
  }
  await db.user.update({ where: { email }, data: { passwordHash: await hashPassword(password), role: "ADMIN", status: "ACTIVE" } });
  return { ok: true, email };
}

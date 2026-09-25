import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import { isAdmin } from "@/lib/roles";

/** For admin-only pages (financial / commercial data). APIs use route({ auth: "admin" }). */
export async function requireAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user.role)) redirect("/admin");
  return user;
}

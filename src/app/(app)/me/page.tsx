import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export default async function MePage() {
  const user = await getSessionUser();
  redirect(user ? `/u/${user.username}` : "/login?next=/me");
}

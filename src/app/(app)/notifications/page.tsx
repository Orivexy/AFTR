import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { listNotifications } from "@/server/services/notifications";
import { NotificationList } from "@/components/social/notification-list";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/notifications");
  const initial = await listNotifications(user.id);
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 md:pt-10">
      <h1 className="mb-4 font-display text-[28px] font-bold">Notificaciones</h1>
      <NotificationList initial={initial} />
    </div>
  );
}

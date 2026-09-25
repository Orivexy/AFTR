import { route } from "@/server/http";
import { unreadCount } from "@/server/services/notifications";

export const GET = route({}, async ({ user }) => ({ count: user ? await unreadCount(user.id) : 0 }));

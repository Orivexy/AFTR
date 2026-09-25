import { route } from "@/server/http";
import { listMyOrders } from "@/server/monetization/orders";

export const GET = route({ auth: true, rateLimit: "read" }, async ({ user }) => ({ items: await listMyOrders(user!.id) }));

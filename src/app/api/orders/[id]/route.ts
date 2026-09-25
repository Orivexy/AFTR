import { route } from "@/server/http";
import { getOrder } from "@/server/monetization/orders";

export const GET = route<{ id: string }>({ auth: true, rateLimit: "read" }, async ({ params, user }) => ({ order: await getOrder(user!, params.id) }));

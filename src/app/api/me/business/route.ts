import { route } from "@/server/http";
import { listOwnBusinesses } from "@/server/monetization/business";

export const GET = route({ auth: true, rateLimit: "read" }, async ({ user }) => ({ items: await listOwnBusinesses(user!.id) }));

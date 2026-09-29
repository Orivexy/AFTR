import { route } from "@/server/http";
import { listBlocked } from "@/server/services/blocks";

export const GET = route({ auth: true }, async ({ user }) => ({ items: await listBlocked(user!.id) }));

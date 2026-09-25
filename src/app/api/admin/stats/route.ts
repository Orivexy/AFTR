import { route } from "@/server/http";
import { adminStats } from "@/server/services/admin";

export const GET = route({ auth: "moderator" }, async () => adminStats());

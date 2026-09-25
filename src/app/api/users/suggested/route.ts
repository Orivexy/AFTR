import { route } from "@/server/http";
import { suggestedUsers } from "@/server/services/users";
import { getCurrentCity } from "@/server/services/cities";

export const GET = route({ rateLimit: "read" }, async ({ user }) => {
  const city = await getCurrentCity();
  return { items: await suggestedUsers(user?.id, city.id, 12) };
});

import { route, parseJson } from "@/server/http";
import { profileUpdateSchema } from "@/lib/validators";
import { updateProfile } from "@/server/services/users";

export const PATCH = route({ auth: true, rateLimit: "interaction" }, async ({ req, user }) => {
  const input = await parseJson(req, profileUpdateSchema);
  return { profile: await updateProfile(user!, input) };
});

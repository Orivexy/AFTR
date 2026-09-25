import { route, parseJson } from "@/server/http";
import { postInputSchema } from "@/lib/validators";
import { createPost } from "@/server/services/posts";

export const POST = route({ auth: true, rateLimit: "createPost" }, async ({ req, user }) => {
  const input = await parseJson(req, postInputSchema);
  return createPost(user!, input);
});

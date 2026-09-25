import { route } from "@/server/http";
import { deleteComment } from "@/server/services/posts";

export const DELETE = route<{ id: string }>({ auth: true }, async ({ params, user }) => {
  await deleteComment(user!, params.id);
  return { ok: true };
});

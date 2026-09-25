import { route, notFound } from "@/server/http";
import { deletePost, getPost } from "@/server/services/posts";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ params, user }) => {
  const post = await getPost(params.id, user?.id);
  if (!post) throw notFound("Publicación no encontrada");
  return { post };
});

export const DELETE = route<{ id: string }>({ auth: true }, async ({ params, user }) => {
  await deletePost(user!, params.id);
  return { ok: true };
});

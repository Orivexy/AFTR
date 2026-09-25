import { z } from "zod";
import { route, parseJson, parseQuery } from "@/server/http";
import { commentSchema } from "@/lib/validators";
import { addComment, listComments } from "@/server/services/posts";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params, user }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(20).optional() }));
  return listComments(params.id, user, cursor);
});

export const POST = route<{ id: string }>({ auth: true, rateLimit: "comment" }, async ({ req, params, user }) => {
  const { body } = await parseJson(req, commentSchema);
  return { comment: await addComment(user!, params.id, body) };
});

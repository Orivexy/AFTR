import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { listPosts } from "@/server/services/posts";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params, user }) => {
  const { cursor, tagged } = parseQuery(req, z.object({ cursor: z.string().max(20).optional(), tagged: z.literal("1").optional() }));
  return tagged
    ? listPosts({ taggedUserId: params.id, viewerId: user?.id, cursor })
    : listPosts({ authorId: params.id, viewerId: user?.id, cursor });
});

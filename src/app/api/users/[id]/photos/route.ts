import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { userPhotos } from "@/server/services/users";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(20).optional() }));
  return userPhotos(params.id, cursor);
});

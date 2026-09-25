import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { listReviews } from "@/server/services/venues";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params }) => {
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(20).optional() }));
  return listReviews(params.id, cursor);
});

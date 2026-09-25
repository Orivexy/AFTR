import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { listAttendees } from "@/server/services/events";

const q = z.object({ status: z.enum(["INTERESTED", "GOING"]).default("GOING"), cursor: z.string().max(20).optional() });

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ req, params }) => {
  const { status, cursor } = parseQuery(req, q);
  return listAttendees(params.id, status, cursor);
});

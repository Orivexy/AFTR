import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { moderateEvent } from "@/server/services/events";
import { deleteEvent, setEventFeatured } from "@/server/services/admin";

const body = z.object({
  decision: z.enum(["approve", "reject"]).optional(),
  featured: z.boolean().optional(),
});

export const PATCH = route<{ id: string }>({ auth: "moderator" }, async ({ req, params }) => {
  const input = await parseJson(req, body);
  if (input.decision) await moderateEvent(params.id, input.decision);
  if (input.featured !== undefined) await setEventFeatured(params.id, input.featured);
  return { ok: true };
});

export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  await deleteEvent(params.id);
  return { ok: true };
});

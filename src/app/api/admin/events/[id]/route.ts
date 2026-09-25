import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { moderateEvent } from "@/server/services/events";
import { deleteEvent, setEventFeatured } from "@/server/services/admin";
import { markEventVerified } from "@/server/discovery/review";

const body = z.object({
  decision: z.enum(["approve", "reject"]).optional(),
  featured: z.boolean().optional(),
  verified: z.boolean().optional(),
});

export const PATCH = route<{ id: string }>({ auth: "moderator", audit: { action: "event.moderate", targetType: "EVENT" } }, async ({ req, params }) => {
  const input = await parseJson(req, body);
  if (input.decision) await moderateEvent(params.id, input.decision);
  if (input.featured !== undefined) await setEventFeatured(params.id, input.featured);
  if (input.verified !== undefined) await markEventVerified(params.id, input.verified);
  return { ok: true };
});

export const DELETE = route<{ id: string }>({ auth: "admin", audit: { action: "event.delete", targetType: "EVENT" } }, async ({ params }) => {
  await deleteEvent(params.id);
  return { ok: true };
});

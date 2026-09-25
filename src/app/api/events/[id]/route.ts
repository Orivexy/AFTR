import { route, parseJson, notFound } from "@/server/http";
import { eventInputSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { cancelEvent, getEventDetail, updateEvent } from "@/server/services/events";

export const GET = route<{ id: string }>({ rateLimit: "read" }, async ({ params, user }) => {
  const e = await db.event.findUnique({ where: { id: params.id }, select: { slug: true } });
  const detail = e ? await getEventDetail(e.slug, user) : null;
  if (!detail) throw notFound("Evento no encontrado");
  return { event: detail };
});

export const PATCH = route<{ id: string }>({ auth: true, rateLimit: "createEvent" }, async ({ req, params, user }) => {
  const input = await parseJson(req, eventInputSchema);
  return updateEvent(user!, params.id, input);
});

/** Organisers cancel (soft); admins can hard-delete from the admin API. */
export const DELETE = route<{ id: string }>({ auth: true }, async ({ params, user }) => {
  await cancelEvent(user!, params.id);
  return { ok: true };
});

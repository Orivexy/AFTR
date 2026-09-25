import { route, parseJson, badRequest } from "@/server/http";
import { discoveryRecordActionSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { approveRecord, deleteRecord, mergeRecord, rejectRecord } from "@/server/discovery/review";

export const POST = route<{ id: string }>({ auth: "moderator", audit: { action: "discovery.record.review", targetType: "SOURCE_EVENT_RECORD" } }, async ({ req, params, user }) => {
  const { action, eventId, edits } = await parseJson(req, discoveryRecordActionSchema);
  switch (action) {
    case "approve": {
      try {
        const event = await approveRecord(params.id, user!.id, edits);
        return { eventId: event.id };
      } catch (err) {
        throw badRequest((err as Error).message);
      }
    }
    case "merge":
      if (!eventId) throw badRequest("Indica el evento con el que fusionar");
      const target = await db.event.findFirst({ where: { OR: [{ id: eventId }, { slug: eventId }] }, select: { id: true } });
      if (!target) throw badRequest("Evento no encontrado");
      await mergeRecord(params.id, target.id, user!.id);
      return { ok: true };
    case "reject":
      await rejectRecord(params.id, user!.id);
      return { ok: true };
    case "delete":
      await deleteRecord(params.id);
      return { ok: true };
  }
});

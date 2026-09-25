import { route } from "@/server/http";
import { db } from "@/server/db";

/** Ids of the viewer's saved events (lets every card show its saved state with one request). */
export const GET = route({ auth: true, rateLimit: "read" }, async ({ user }) => {
  const rows = await db.savedEvent.findMany({ where: { userId: user!.id }, select: { eventId: true }, orderBy: { createdAt: "desc" }, take: 1000 });
  return { ids: rows.map((r) => r.eventId) };
});

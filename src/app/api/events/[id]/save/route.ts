import { z } from "zod";
import { route, parseJson } from "@/server/http";
import { toggleSaveEvent } from "@/server/services/events";

export const PUT = route<{ id: string }>({ auth: true, rateLimit: "interaction" }, async ({ req, params, user }) => {
  const { saved } = await parseJson(req, z.object({ saved: z.boolean() }));
  return toggleSaveEvent(user!.id, params.id, saved);
});

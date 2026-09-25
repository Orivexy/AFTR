import { z } from "zod";
import { route, parseJson, forbidden, badRequest } from "@/server/http";
import { setUserSuspended } from "@/server/services/reports";
import { setUserRole } from "@/server/services/admin";
import { ROLES, isAdmin } from "@/lib/roles";

const body = z.object({
  suspended: z.boolean().optional(),
  role: z.enum(ROLES).optional(),
});

export const PATCH = route<{ id: string }>({ auth: "moderator", audit: { action: "user.update", targetType: "USER" } }, async ({ req, params, user }) => {
  const input = await parseJson(req, body);
  if (params.id === user!.id) throw badRequest("No puedes modificar tu propia cuenta aquí");
  if (input.suspended !== undefined) await setUserSuspended(params.id, input.suspended);
  if (input.role) {
    if (!isAdmin(user!.role)) throw forbidden("Solo administradores pueden cambiar roles");
    await setUserRole(params.id, input.role);
  }
  return { ok: true };
});

import { route, parseJson } from "@/server/http";
import { SETTINGS_SCHEMA, getSettings, updateSettings } from "@/server/settings";

export const GET = route({ auth: "admin" }, async () => getSettings());

export const PATCH = route({ auth: "admin", audit: { action: "settings.update", targetType: "SETTINGS" } }, async ({ req, user }) => {
  return updateSettings(await parseJson(req, SETTINGS_SCHEMA.partial()), user!.id);
});

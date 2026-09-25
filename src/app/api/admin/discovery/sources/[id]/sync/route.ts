import { route } from "@/server/http";
import { syncSource } from "@/server/discovery/engine";

export const maxDuration = 300;

/** Runs a sync now (also works for disabled sources, for testing). */
export const POST = route<{ id: string }>({ auth: "admin", audit: { action: "discovery.source.sync", targetType: "DISCOVERY_SOURCE" } }, async ({ params }) => {
  return syncSource(params.id);
});

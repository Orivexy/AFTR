import { route, parseJson } from "@/server/http";
import { discoverySourceUpdateSchema } from "@/lib/validators";
import { db } from "@/server/db";
import type { Prisma } from "@prisma/client";

export const PATCH = route<{ id: string }>({ auth: "admin", audit: { action: "discovery.source.update", targetType: "DISCOVERY_SOURCE" } }, async ({ req, params }) => {
  const { venueSlug, config, ...input } = await parseJson(req, discoverySourceUpdateSchema);
  const venue = venueSlug ? await db.venue.findUnique({ where: { slug: venueSlug }, select: { id: true } }) : undefined;
  await db.discoverySource.update({
    where: { id: params.id },
    data: {
      ...input,
      ...(venueSlug !== undefined ? { venueId: venue?.id ?? null } : {}),
      ...(config !== undefined ? { config: (config ?? {}) as Prisma.InputJsonValue } : {}),
      // Re-enabling schedules an immediate sync.
      ...(input.enabled ? { nextSyncAt: new Date() } : {}),
    },
  });
  return { ok: true };
});

export const DELETE = route<{ id: string }>({ auth: "admin", audit: { action: "discovery.source.delete", targetType: "DISCOVERY_SOURCE" } }, async ({ params }) => {
  // Events stay; their records (links) are removed with the source.
  await db.discoverySource.delete({ where: { id: params.id } });
  return { ok: true };
});

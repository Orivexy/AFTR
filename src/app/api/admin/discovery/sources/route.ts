import { route, parseJson, badRequest } from "@/server/http";
import { discoverySourceSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { getCityBySlug } from "@/server/services/cities";
import { audit } from "@/server/audit";
import type { Prisma } from "@prisma/client";

export const POST = route({ auth: "admin" }, async ({ req, user, ip }) => {
  const { citySlug, venueSlug, config, ...input } = await parseJson(req, discoverySourceSchema);
  const city = await getCityBySlug(citySlug);
  if (!city) throw badRequest("Ciudad no válida");
  const venue = venueSlug ? await db.venue.findUnique({ where: { slug: venueSlug }, select: { id: true } }) : null;
  if (venueSlug && !venue) throw badRequest("Local no válido");
  if (["ICS_FEED", "JSON_LD_PAGE", "PARTNER_FEED"].includes(input.type) && !input.url) throw badRequest("Esta fuente necesita una URL", { url: "Obligatoria" });
  const source = await db.discoverySource.create({
    data: { ...input, url: input.url ?? null, cityId: city.id, venueId: venue?.id, config: (config ?? undefined) as Prisma.InputJsonValue | undefined },
    select: { id: true },
  });
  await audit({ actorId: user!.id, action: "discovery.source.create", targetType: "DISCOVERY_SOURCE", targetId: source.id, metadata: { key: input.key, type: input.type, url: input.url ?? null }, ip });
  return { source };
});

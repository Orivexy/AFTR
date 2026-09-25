import { z } from "zod";
import { route, parseQuery } from "@/server/http";
import { db } from "@/server/db";
import { normalizeSearch } from "@/lib/text";

/** Username autocomplete for tagging people in posts. */
export const GET = route({ auth: true, rateLimit: "read" }, async ({ req }) => {
  const { q } = parseQuery(req, z.object({ q: z.string().max(30) }));
  const term = normalizeSearch(q).replace(/^@/, "");
  if (term.length < 1) return { items: [] };
  const items = await db.profile.findMany({
    where: { user: { status: "ACTIVE" }, OR: [{ username: { startsWith: term } }, { searchText: { contains: term } }] },
    orderBy: { followerCount: "desc" },
    select: { userId: true, username: true, displayName: true, avatarKey: true },
    take: 8,
  });
  return { items: items.map(({ userId, ...p }) => ({ id: userId, ...p })) };
});

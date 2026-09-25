import "server-only";
import { db } from "../db";
import { buildSearchText, slugify } from "@/lib/text";
import { site } from "@/config/site";

/** Returns `base` or `base2`, `base3`… — the first username not taken. */
export async function availableUsername(base: string): Promise<string> {
  const clean = slugify(base).replace(/-/g, "_").slice(0, 20) || "user";
  const candidates = [clean, ...Array.from({ length: 8 }, () => `${clean}${Math.floor(Math.random() * 9000 + 100)}`)];
  const taken = await db.profile.findMany({
    where: { username: { in: candidates } },
    select: { username: true },
  });
  const takenSet = new Set(taken.map((t) => t.username));
  return candidates.find((c) => !takenSet.has(c) && c.length >= 3) ?? `${clean}${Date.now().toString(36)}`;
}

export async function defaultCityId(): Promise<string | null> {
  const city = await db.city.findUnique({ where: { slug: site.defaultCitySlug }, select: { id: true } });
  return city?.id ?? null;
}

interface NewUser {
  email: string;
  passwordHash?: string;
  username: string;
  displayName: string;
  emailVerified?: Date;
  account?: { provider: string; providerAccountId: string };
}

export async function createUserWithProfile(input: NewUser) {
  const cityId = await defaultCityId();
  return db.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      emailVerified: input.emailVerified,
      profile: {
        create: {
          username: input.username,
          displayName: input.displayName,
          cityId,
          searchText: buildSearchText(input.username, input.displayName),
        },
      },
      accounts: input.account ? { create: input.account } : undefined,
    },
  });
}

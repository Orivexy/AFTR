import "server-only";
import { db } from "../db";
import { env } from "../env";
import { getSettings } from "../settings";
import { ApiError } from "../errors";
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
  if (!(await getSettings()).registrationsOpen) throw new ApiError(403, "El registro de nuevas cuentas está cerrado temporalmente.", "REGISTRATIONS_CLOSED");
  const cityId = await defaultCityId();
  // Local single-user installs (desktop app): the first account administers it.
  const firstAdmin = env.FIRST_USER_IS_ADMIN && (await db.user.count({ where: { role: "ADMIN" } })) === 0;
  return db.user.create({
    data: {
      email: input.email,
      ...(firstAdmin ? { role: "ADMIN" as const } : {}),
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

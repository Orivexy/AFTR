import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import type { Role, UserStatus } from "@prisma/client";
import { db } from "../db";
import { isProd } from "../env";
import { site } from "@/config/site";

/**
 * Opaque, server-side sessions. The cookie holds a random token; the
 * database stores only its SHA-256, so a leaked DB can't be replayed.
 */
export const SESSION_COOKIE = `${site.slug}_session`;
const SESSION_TTL_MS = 30 * 24 * 3600_000;
const SESSION_REFRESH_MS = 15 * 24 * 3600_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  username: string;
  displayName: string;
  avatarKey: string | null;
  cityId: string | null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
      ipAddress: (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64) || null,
    },
  });
  await setSessionCookie(token, expiresAt);
}

async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Invalidates every session of a user (password change, suspension). */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/**
 * Current user for this request (memoised per request via React `cache`).
 * Expired sessions are deleted; sessions past half their life are extended.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          profile: { select: { username: true, displayName: true, avatarKey: true, cityId: true } },
        },
      },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.expiresAt.getTime() - now < SESSION_REFRESH_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } });
    // Cookies can only be written from route handlers / server actions.
    await setSessionCookie(token, expiresAt).catch(() => {});
  }

  const { user } = session;
  if (!user.profile) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    ...user.profile,
  };
});

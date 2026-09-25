import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getOAuthProvider } from "@/server/auth/oauth/providers";
import { createSession } from "@/server/auth/session";
import { availableUsername, createUserWithProfile } from "@/server/auth/users";

/**
 * OAuth callback: validates state (CSRF) + PKCE, then links the identity to
 * an existing account (same verified email) or creates a new one.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, env.APP_URL));

  const provider = getOAuthProvider(providerId);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = jar.get("oauth_state")?.value;
  const verifier = jar.get("oauth_verifier")?.value;
  const next = jar.get("oauth_next")?.value ?? "/";
  jar.delete("oauth_state");
  jar.delete("oauth_verifier");
  jar.delete("oauth_next");

  if (!provider?.enabled || !code || !state || !verifier || state !== storedState) return fail("oauth_state");

  let profile;
  try {
    profile = await provider.exchange(code, verifier);
  } catch (err) {
    console.error("[oauth] exchange failed", err);
    return fail("oauth_exchange");
  }

  const linked = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: provider.id, providerAccountId: profile.providerAccountId } },
    select: { user: { select: { id: true, status: true } } },
  });

  let userId = linked?.user.id;
  if (linked?.user.status === "SUSPENDED") return fail("suspended");

  if (!userId) {
    const existing = await db.user.findUnique({ where: { email: profile.email }, select: { id: true, status: true } });
    if (existing) {
      // Only auto-link when the provider verified the email.
      if (!profile.emailVerified) return fail("oauth_email_unverified");
      if (existing.status === "SUSPENDED") return fail("suspended");
      await db.account.create({ data: { userId: existing.id, provider: provider.id, providerAccountId: profile.providerAccountId } });
      userId = existing.id;
    } else {
      const user = await createUserWithProfile({
        email: profile.email,
        emailVerified: profile.emailVerified ? new Date() : undefined,
        username: await availableUsername(profile.email.split("@")[0]!),
        displayName: profile.name?.slice(0, 50) || profile.email.split("@")[0]!,
        account: { provider: provider.id, providerAccountId: profile.providerAccountId },
      });
      userId = user.id;
    }
  }

  await createSession(userId);
  return NextResponse.redirect(new URL(next, env.APP_URL));
}

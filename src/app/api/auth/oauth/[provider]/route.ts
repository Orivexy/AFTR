import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { route, notFound } from "@/server/http";
import { getOAuthProvider } from "@/server/auth/oauth/providers";
import { useSecureCookies } from "@/server/env";

export const GET = route<{ provider: string }>({ rateLimit: "auth" }, async ({ params, req }) => {
  const provider = getOAuthProvider(params.provider);
  if (!provider?.enabled) throw notFound("Proveedor no disponible");

  const state = generateState();
  const verifier = generateCodeVerifier();
  const next = req.nextUrl.searchParams.get("next");
  const jar = await cookies();
  const opts = { httpOnly: true, secure: useSecureCookies, sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("oauth_state", state, opts);
  jar.set("oauth_verifier", verifier, opts);
  if (next?.startsWith("/") && !next.startsWith("//")) jar.set("oauth_next", next, opts);

  return NextResponse.redirect(provider.createAuthorizationURL(state, verifier));
});

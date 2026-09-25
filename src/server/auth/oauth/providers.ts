import "server-only";
import { Google, decodeIdToken } from "arctic";
import { env, features } from "../../env";

/**
 * OAuth providers behind one small interface so Apple / TikTok can be added
 * by implementing `OAuthProvider` and registering it below.
 */
export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface OAuthProvider {
  id: string;
  enabled: boolean;
  createAuthorizationURL(state: string, codeVerifier: string): URL;
  exchange(code: string, codeVerifier: string): Promise<OAuthProfile>;
}

const redirectUri = (id: string) => `${env.APP_URL}/api/auth/oauth/${id}/callback`;

function googleProvider(): OAuthProvider {
  const client = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri("google"));
  return {
    id: "google",
    enabled: features.googleAuth,
    createAuthorizationURL: (state, verifier) =>
      client.createAuthorizationURL(state, verifier, ["openid", "email", "profile"]),
    async exchange(code, verifier) {
      const tokens = await client.validateAuthorizationCode(code, verifier);
      const claims = decodeIdToken(tokens.idToken()) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!claims.email) throw new Error("Google account without email");
      return {
        providerAccountId: claims.sub,
        email: claims.email.toLowerCase(),
        emailVerified: Boolean(claims.email_verified),
        name: claims.name ?? null,
      };
    },
  };
}

export function getOAuthProvider(id: string): OAuthProvider | null {
  switch (id) {
    case "google":
      return googleProvider();
    default:
      return null;
  }
}

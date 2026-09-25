import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "./env";
import { checkRateLimit, type RateLimitName } from "./security/rate-limit";
import { getSessionUser, type SessionUser } from "./auth/session";

export { ApiError, unauthorized, forbidden, notFound, badRequest } from "./errors";
import { ApiError, unauthorized, forbidden, badRequest } from "./errors";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer)
 * must match our own host. Combined with SameSite=Lax cookies.
 */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return; // non-browser clients (no ambient cookies) are fine
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw forbidden("Origen no válido");
  }
  const allowed = new Set([req.headers.get("host"), new URL(env.APP_URL).host]);
  if (!allowed.has(host)) throw forbidden("Origen no válido");
}

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { message: err.message, code: err.code, fields: err.fields } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const fields = zodFields(err);
    return NextResponse.json(
      { error: { message: Object.values(fields)[0] ?? "Datos no válidos", code: "VALIDATION", fields } },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return NextResponse.json({ error: { message: "No encontrado", code: "NOT_FOUND" } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { message: "Algo ha fallado. Inténtalo de nuevo.", code: "INTERNAL" } }, { status: 500 });
}

interface HandlerContext<P> {
  req: NextRequest;
  params: P;
  user: SessionUser | null;
  ip: string;
}

interface RouteOptions {
  /** Require an authenticated, active user. */
  auth?: boolean | "moderator" | "admin";
  rateLimit?: RateLimitName;
}

type RouteHandler<P> = (ctx: HandlerContext<P>) => Promise<Response | unknown>;

/**
 * Wraps a route handler with: auth, role checks, CSRF origin check for
 * mutations, rate limiting and uniform error responses. Non-Response return
 * values are serialised as JSON.
 */
export function route<P = Record<string, never>>(options: RouteOptions, handler: RouteHandler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating) assertSameOrigin(req);

      const user = await getSessionUser();
      if (options.auth) {
        if (!user) throw unauthorized();
        if (user.status === "SUSPENDED") throw forbidden("Tu cuenta está suspendida");
        if (options.auth === "admin" && user.role !== "ADMIN") throw forbidden();
        if (options.auth === "moderator" && user.role === "USER") throw forbidden();
      }

      const ip = clientIp(req);
      if (options.rateLimit) {
        const rl = checkRateLimit(options.rateLimit, user?.id ?? ip);
        if (!rl.ok) {
          return NextResponse.json(
            { error: { message: "Demasiadas peticiones. Espera un momento.", code: "RATE_LIMITED" } },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
          );
        }
      }

      const params = (await context?.params) ?? ({} as P);
      const result = await handler({ req, params, user, ip });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("JSON no válido");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

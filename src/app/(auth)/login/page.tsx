import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/auth-forms";
import { getSessionUser } from "@/server/auth/session";
import { features } from "@/server/env";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  oauth_state: "La sesión con Google caducó. Inténtalo de nuevo.",
  oauth_exchange: "No se pudo completar el acceso con Google.",
  oauth_email_unverified: "Tu email de Google no está verificado.",
  suspended: "Tu cuenta está suspendida.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  if (await getSessionUser()) redirect(target === "/me" ? "/" : target);
  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Hola de nuevo</h1>
        <p className="mt-2 text-muted">Entra para ver quién va, guardar planes y compartir la noche.</p>
      </div>
      {error && ERRORS[error] && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{ERRORS[error]}</p>}
      <LoginForm next={target} googleEnabled={features.googleAuth} />
      <p className="text-center text-sm text-muted">
        ¿Nuevo por aquí?{" "}
        <Link href={`/register?next=${encodeURIComponent(target)}`} className="font-semibold text-fg underline-offset-4 hover:underline">
          Crea una cuenta
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/auth-forms";
import { getSessionUser } from "@/server/auth/session";
import { features } from "@/server/env";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getSessionUser()) redirect(target === "/me" ? "/" : target);
  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Únete a la noche</h1>
        <p className="mt-2 text-muted">Descubre planes, di a dónde vas y comparte lo que pasa.</p>
      </div>
      <RegisterForm next={target} googleEnabled={features.googleAuth} />
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/login?next=${encodeURIComponent(target)}`} className="font-semibold text-fg underline-offset-4 hover:underline">
          Entra
        </Link>
      </p>
    </div>
  );
}

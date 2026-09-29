import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Nueva contraseña</h1>
        <p className="mt-2 text-muted">Elige una contraseña que no uses en otros sitios.</p>
      </div>
      {token && token.length >= 20 ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          El enlace no es válido. <Link href="/forgot-password" className="underline">Pide uno nuevo</Link>.
        </p>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { emailAvailable } from "@/server/email";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">¿Olvidaste tu contraseña?</h1>
        <p className="mt-2 text-muted">Escribe el email de tu cuenta y te enviaremos un enlace para crear una nueva.</p>
      </div>
      <ForgotPasswordForm available={emailAvailable()} />
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-fg underline-offset-4 hover:underline">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}

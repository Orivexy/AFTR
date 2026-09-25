"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, ApiClientError } from "@/lib/api-client";
import { safeNext } from "@/lib/safe-next";

function GoogleButton({ next }: { next: string }) {
  return (
    <>
      <a
        href={`/api/auth/oauth/google?next=${encodeURIComponent(next)}`}
        className="pressable flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface font-semibold hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continuar con Google
      </a>
      <div className="flex items-center gap-3 text-xs font-semibold tracking-wider text-faint uppercase">
        <span className="h-px flex-1 bg-line" /> o con email <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute inset-y-0 right-2 grid w-10 place-items-center text-muted">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function useSubmit(url: string, next: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (body: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await api.post(url, body);
      // Full navigation so every server component re-renders with the session.
      window.location.assign(safeNext(next === "/me" ? "/" : next));
    } catch (err) {
      const e = err as ApiClientError;
      setError(e.message);
      setFields(e.fields ?? {});
      setLoading(false);
    }
  };
  return { loading, error, fields, submit };
}

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const { loading, error, submit } = useSubmit("/api/auth/login", next);
  return (
    <div className="space-y-5">
      {googleEnabled && <GoogleButton next={next} />}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void submit({ email: f.get("email"), password: f.get("password") });
        }}
      >
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="tu@email.com" />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>
    </div>
  );
}

export function RegisterForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const { loading, error, fields, submit } = useSubmit("/api/auth/register", next);
  return (
    <div className="space-y-5">
      {googleEnabled && <GoogleButton next={next} />}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void submit({
            displayName: f.get("displayName"),
            username: f.get("username"),
            email: f.get("email"),
            password: f.get("password"),
            website: f.get("website") || undefined,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" htmlFor="displayName" error={fields.displayName}>
            <Input id="displayName" name="displayName" autoComplete="given-name" required maxLength={50} placeholder="Eric" />
          </Field>
          <Field label="Usuario" htmlFor="username" error={fields.username}>
            <Input id="username" name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_.]+" placeholder="eric" />
          </Field>
        </div>
        <Field label="Email" htmlFor="email" error={fields.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="tu@email.com" />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={fields.password} hint="Mínimo 8 caracteres, con letras y números">
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} />
        </Field>
        {/* Honeypot for bots — hidden from people and assistive tech */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        {error && !Object.keys(fields).length && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Crear cuenta
        </Button>
        <p className="text-center text-xs text-faint">Al registrarte aceptas las normas de la comunidad. Solo mayores de edad en eventos +18.</p>
      </form>
    </div>
  );
}

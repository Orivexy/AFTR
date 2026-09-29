"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, MonitorSmartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";
import { PasswordInput } from "./auth-forms";

/** Password, sessions and account deletion (Ajustes → Cuenta). */
export function AccountSettings({ username, hasPassword }: { username: string; hasPassword: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const leave = () => {
    router.replace("/");
    router.refresh();
  };
  const [pwd, setPwd] = useState({ saving: false, fields: {} as Record<string, string> });
  const [del, setDel] = useState({ open: false, saving: false, fields: {} as Record<string, string> });

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("password") !== f.get("confirm")) return setPwd({ saving: false, fields: { confirm: "No coincide" } });
    setPwd({ saving: true, fields: {} });
    try {
      await api.put("/api/me/password", { currentPassword: f.get("currentPassword") || undefined, password: f.get("password") });
      form.reset();
      toast(hasPassword ? "Contraseña cambiada. Se ha cerrado la sesión en tus otros dispositivos." : "Contraseña creada");
      setPwd({ saving: false, fields: {} });
    } catch (err) {
      const e2 = err as ApiClientError;
      toast(e2.message, "error");
      setPwd({ saving: false, fields: e2.fields ?? {} });
    }
  };

  const logout = async (everywhere: boolean) => {
    await api.post("/api/auth/logout", { everywhere });
    leave();
  };

  const deleteAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setDel((d) => ({ ...d, saving: true, fields: {} }));
    try {
      await api.del("/api/me/account", { confirm: f.get("confirm"), password: f.get("password") || undefined });
      leave();
    } catch (err) {
      const e2 = err as ApiClientError;
      toast(e2.message, "error");
      setDel((d) => ({ ...d, saving: false, fields: e2.fields ?? {} }));
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="size-4" /> {hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
        </h2>
        {!hasPassword && <p className="text-sm text-muted">Entras con Google. Crea una contraseña si también quieres entrar con tu email.</p>}
        <form onSubmit={changePassword} className="space-y-4">
          {hasPassword && (
            <Field label="Contraseña actual" htmlFor="currentPassword" error={pwd.fields.currentPassword}>
              <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
            </Field>
          )}
          <Field label="Nueva contraseña" htmlFor="newPassword" error={pwd.fields.password} hint="Mínimo 8 caracteres, con letras y números">
            <PasswordInput id="newPassword" name="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Repite la contraseña" htmlFor="confirmPassword" error={pwd.fields.confirm}>
            <PasswordInput id="confirmPassword" name="confirm" autoComplete="new-password" required minLength={8} />
          </Field>
          <Button type="submit" variant="secondary" className="w-full" loading={pwd.saving}>
            Guardar contraseña
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MonitorSmartphone className="size-4" /> Sesiones
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={() => logout(false)}>
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
          <Button type="button" variant="secondary" onClick={() => logout(true)}>
            Cerrar en todos los dispositivos
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-danger/30 p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-danger">
          <Trash2 className="size-4" /> Eliminar cuenta
        </h2>
        <p className="text-sm text-muted">Se borrarán tu perfil, publicaciones, fotos, vídeos, comentarios, valoraciones y los eventos que hayas creado. No se puede deshacer.</p>
        {del.open ? (
          <form onSubmit={deleteAccount} className="space-y-3">
            <Field label={`Escribe «${username}» para confirmar`} htmlFor="confirmDelete" error={del.fields.confirm}>
              <Input id="confirmDelete" name="confirm" autoComplete="off" required />
            </Field>
            {hasPassword && (
              <Field label="Contraseña" htmlFor="deletePassword" error={del.fields.password}>
                <PasswordInput id="deletePassword" name="password" autoComplete="current-password" required />
              </Field>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setDel({ open: false, saving: false, fields: {} })}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" className="flex-1" loading={del.saving}>
                Eliminar mi cuenta
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="danger" onClick={() => setDel((d) => ({ ...d, open: true }))}>
            Eliminar cuenta…
          </Button>
        )}
      </section>
    </div>
  );
}

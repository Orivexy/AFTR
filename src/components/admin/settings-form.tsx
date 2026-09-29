"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";

interface Settings {
  eventModeration: "off" | "new_users" | "all";
  autoHideReportThreshold: number;
  registrationsOpen: boolean;
  discoveryEnabled: boolean;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#d7ff3a]" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.patch("/api/admin/settings", v);
      toast("Ajustes guardados");
      router.refresh();
    } catch (err) {
      setErrors((err as ApiClientError).fields ?? {});
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <Toggle label="Registro abierto" hint="Si lo desactivas, nadie nuevo puede crear cuenta (tampoco con Google)." checked={v.registrationsOpen} onChange={(x) => setV({ ...v, registrationsOpen: x })} />
      <Toggle label="Sincronización automática" hint="Descubrimiento de locales, horarios y eventos desde las fuentes configuradas." checked={v.discoveryEnabled} onChange={(x) => setV({ ...v, discoveryEnabled: x })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Moderación de eventos" htmlFor="mod" error={errors.eventModeration}>
          <Select id="mod" value={v.eventModeration} onChange={(e) => setV({ ...v, eventModeration: e.target.value as Settings["eventModeration"] })}>
            <option value="off">Publicar al momento</option>
            <option value="new_users">Revisar cuentas nuevas (&lt; 7 días)</option>
            <option value="all">Revisar todos</option>
          </Select>
        </Field>
        <Field label="Ocultar tras N reportes" htmlFor="thr" hint="Reportes de usuarios distintos" error={errors.autoHideReportThreshold}>
          <Input id="thr" inputMode="numeric" value={String(v.autoHideReportThreshold)} onChange={(e) => setV({ ...v, autoHideReportThreshold: Number(e.target.value.replace(/\D/g, "")) || 1 })} />
        </Field>
      </div>
      <Button type="submit" loading={saving}>Guardar ajustes</Button>
    </form>
  );
}

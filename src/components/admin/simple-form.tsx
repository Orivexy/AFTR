"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";

export type SimpleField =
  | { name: string; label: string; type?: "text" | "email" | "url" | "number" | "date"; required?: boolean; placeholder?: string; hint?: string }
  | { name: string; label: string; type: "select"; options: Array<{ value: string; label: string }>; required?: boolean; hint?: string };

/**
 * Generic admin form in a sheet: posts the field values as JSON (empty
 * strings omitted, `number` fields converted) and refreshes the page.
 */
export function SimpleForm({ trigger, title, url, method = "POST", fields, submitLabel = "Guardar", note }: { trigger: string; title: string; url: string; method?: "POST" | "PATCH"; fields: SimpleField[]; submitLabel?: string; note?: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const toast = useToast();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const value = String(data.get(f.name) ?? "").trim();
      if (!value) continue;
      body[f.name] = f.type === "number" ? Math.round(Number(value.replace(",", ".")) * 100) : value;
    }
    setSaving(true);
    setErrors({});
    try {
      if (method === "PATCH") await api.patch(url, body);
      else await api.post(url, body);
      toast("Guardado");
      setOpen(false);
      router.refresh();
    } catch (err) {
      const e = err as ApiClientError;
      setErrors(e.fields ?? {});
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{trigger}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <form onSubmit={submit} className="space-y-4 pb-4">
          {fields.map((f) => (
            <Field key={f.name} label={f.label} htmlFor={f.name} error={errors[f.name]} hint={f.hint}>
              {f.type === "select" ? (
                <Select id={f.name} name={f.name} required={f.required} defaultValue="">
                  <option value="" disabled>Elige…</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : (
                <Input id={f.name} name={f.name} type={f.type === "number" ? "text" : (f.type ?? "text")} inputMode={f.type === "number" ? "decimal" : undefined} required={f.required} placeholder={"placeholder" in f ? f.placeholder : undefined} />
              )}
            </Field>
          ))}
          {note && <p className="text-[12px] text-faint">{note}</p>}
          <Button type="submit" loading={saving} className="w-full">{submitLabel}</Button>
        </form>
      </Sheet>
    </>
  );
}

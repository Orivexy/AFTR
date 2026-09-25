"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";

export function PlanEditor({ plan }: { plan: { id: string; name: string; description: string | null; priceCents: number | null; currency: string; interval: string } }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: plan.name, description: plan.description ?? "", price: plan.priceCents == null ? "" : String(plan.priceCents / 100), interval: plan.interval });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/admin/plans/${plan.id}`, {
        name: v.name,
        description: v.description || null,
        priceCents: v.price.trim() === "" ? null : Math.round(Number(v.price.replace(",", ".")) * 100),
        interval: v.interval,
      });
      toast("Plan actualizado");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-8 items-center rounded-full bg-surface-3 px-3 text-[12px] font-bold hover:bg-line-strong">Editar</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Plan ${plan.name}`}>
        <form onSubmit={save} className="space-y-4 pb-4">
          <Field label="Nombre"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Descripción"><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="min-h-20" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio (€)" hint="Vacío = sin definir"><Input inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value.replace(/[^\d.,]/g, "") })} /></Field>
            <Field label="Periodo">
              <select value={v.interval} onChange={(e) => setV({ ...v, interval: e.target.value })} className="h-12 w-full rounded-2xl border border-line-strong bg-surface-2 px-4">
                <option value="month">Mensual</option>
                <option value="year">Anual</option>
              </select>
            </Field>
          </div>
          <p className="text-[12px] text-faint">Los planes no se pueden contratar mientras las suscripciones estén desactivadas.</p>
          <Button type="submit" loading={saving} className="w-full">Guardar</Button>
        </form>
      </Sheet>
    </>
  );
}

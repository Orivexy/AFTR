"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";

interface Props {
  recordId: string;
  initial: { title: string; date: string; startTime: string; endTime: string; venueId: string | null; locationName: string; address: string; lat: string; lng: string; price: string };
  venues: Array<{ id: string; name: string }>;
  duplicateOf: { id: string; title: string } | null;
}

/** Approve / edit+approve / merge / reject / delete for one queued event. */
export function RecordReview({ recordId, initial, venues, duplicateOf }: Props) {
  const [open, setOpen] = useState<"edit" | "merge" | null>(null);
  const [v, setV] = useState(initial);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const act = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      await api.post(`/api/admin/discovery/records/${recordId}`, body);
      toast(success);
      setOpen(null);
      router.refresh();
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const approveWithEdits = (e: React.FormEvent) => {
    e.preventDefault();
    const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
    void act(
      {
        action: "approve",
        edits: {
          title: v.title,
          date: v.date,
          startTime: v.startTime,
          endTime: v.endTime || null,
          venueId: v.venueId,
          ...(v.venueId ? {} : { locationName: v.locationName || undefined, address: v.address || undefined, lat: num(v.lat), lng: num(v.lng) }),
          priceMin: v.price.trim() === "" ? null : Math.round(Number(v.price.replace(",", ".")) * 100),
        },
      },
      "Evento publicado",
    );
  };

  const btn = "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-bold disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => act({ action: "approve" }, "Evento publicado")} className={`${btn} bg-volt text-on-volt`}>Aprobar</button>
      <button disabled={busy} onClick={() => setOpen("edit")} className={`${btn} bg-surface-3 hover:bg-line-strong`}>Editar</button>
      {duplicateOf ? (
        <button disabled={busy} onClick={() => act({ action: "merge", eventId: duplicateOf.id }, "Fusionado")} className={`${btn} bg-surface-3 hover:bg-line-strong`}>Merge con «{duplicateOf.title.slice(0, 24)}»</button>
      ) : (
        <button disabled={busy} onClick={() => setOpen("merge")} className={`${btn} bg-surface-3 hover:bg-line-strong`}>Fusionar</button>
      )}
      <button disabled={busy} onClick={() => act({ action: "reject" }, "Rechazado")} className={`${btn} bg-danger/15 text-danger`}>Rechazar</button>
      <button disabled={busy} onClick={() => confirm("¿Eliminar el registro? Podría volver a importarse.") && act({ action: "delete" }, "Eliminado")} className={`${btn} text-muted hover:text-fg`}>Eliminar</button>

      <Sheet open={open === "merge"} onClose={() => setOpen(null)} title="Fusionar con un evento existente">
        <form onSubmit={(e) => { e.preventDefault(); void act({ action: "merge", eventId: target }, "Fusionado"); }} className="space-y-4 pb-4">
          <Field label="Slug o id del evento" hint="Lo encuentras en la URL del evento (/events/…)"><Input value={target} onChange={(e) => setTarget(e.target.value)} required /></Field>
          <Button type="submit" loading={busy} className="w-full">Fusionar</Button>
        </form>
      </Sheet>

      <Sheet open={open === "edit"} onClose={() => setOpen(null)} title="Editar y aprobar" tall>
        <form onSubmit={approveWithEdits} className="space-y-4 pb-4">
          <Field label="Título"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fecha" className="col-span-3 sm:col-span-1"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
            <Field label="Empieza"><Input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} /></Field>
            <Field label="Termina"><Input type="time" value={v.endTime} onChange={(e) => setV({ ...v, endTime: e.target.value })} /></Field>
          </div>
          <Field label="Local">
            <Select value={v.venueId ?? ""} onChange={(e) => setV({ ...v, venueId: e.target.value || null })}>
              <option value="">Otro lugar</option>
              {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          {!v.venueId && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lugar" className="col-span-2"><Input value={v.locationName} onChange={(e) => setV({ ...v, locationName: e.target.value })} /></Field>
              <Field label="Dirección" className="col-span-2"><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
              <Field label="Latitud"><Input inputMode="decimal" value={v.lat} onChange={(e) => setV({ ...v, lat: e.target.value })} /></Field>
              <Field label="Longitud"><Input inputMode="decimal" value={v.lng} onChange={(e) => setV({ ...v, lng: e.target.value })} /></Field>
            </div>
          )}
          <Field label="Precio desde (€)" hint="Vacío = no especificado · 0 = gratis"><Input inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></Field>
          <Button type="submit" loading={busy} className="w-full" size="lg">Aprobar con cambios</Button>
        </form>
      </Sheet>
    </div>
  );
}

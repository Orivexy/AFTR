"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";

export interface AdminVenue {
  id: string;
  name: string;
  description: string | null;
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  priceMin: number | null;
  priceMax: number | null;
  minAge: number | null;
  website: string | null;
  instagram: string | null;
  isFeatured: boolean;
  isActive: boolean;
}

const euros = (cents: number | null) => (cents == null ? "" : String(cents / 100));
const cents = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(",", ".")) * 100));

export function VenueEditor({ venue }: { venue: AdminVenue }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ ...venue, priceMinE: euros(venue.priceMin), priceMaxE: euros(venue.priceMax), minAgeS: venue.minAge?.toString() ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/admin/venues/${venue.id}`, {
        name: v.name,
        description: v.description || null,
        address: v.address,
        neighborhood: v.neighborhood || null,
        lat: Number(v.lat),
        lng: Number(v.lng),
        priceMin: cents(v.priceMinE),
        priceMax: cents(v.priceMaxE),
        minAge: v.minAgeS ? Number(v.minAgeS) : null,
        website: v.website || "",
        instagram: v.instagram || null,
        isFeatured: v.isFeatured,
        isActive: v.isActive,
      });
      toast("Local actualizado");
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
      <button onClick={() => setOpen(true)} className="inline-flex h-8 items-center rounded-full bg-surface-3 px-3 text-[12px] font-bold hover:bg-line-strong">Editar</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Editar ${venue.name}`} tall>
        <form onSubmit={save} className="space-y-4 pb-4">
          <Field label="Nombre" error={errors.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Descripción" error={errors.description}><Textarea value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <Field label="Dirección" error={errors.address}><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <Field label="Barrio"><Input value={v.neighborhood ?? ""} onChange={(e) => setV({ ...v, neighborhood: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud" error={errors.lat}><Input inputMode="decimal" value={String(v.lat)} onChange={(e) => setV({ ...v, lat: e.target.value as unknown as number })} /></Field>
            <Field label="Longitud" error={errors.lng}><Input inputMode="decimal" value={String(v.lng)} onChange={(e) => setV({ ...v, lng: e.target.value as unknown as number })} /></Field>
            <Field label="Precio mín. (€)"><Input inputMode="decimal" value={v.priceMinE} onChange={(e) => setV({ ...v, priceMinE: e.target.value })} /></Field>
            <Field label="Precio máx. (€)"><Input inputMode="decimal" value={v.priceMaxE} onChange={(e) => setV({ ...v, priceMaxE: e.target.value })} /></Field>
            <Field label="Edad mínima"><Input inputMode="numeric" value={v.minAgeS} onChange={(e) => setV({ ...v, minAgeS: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Instagram"><Input value={v.instagram ?? ""} onChange={(e) => setV({ ...v, instagram: e.target.value })} /></Field>
          </div>
          <Field label="Web" error={errors.website}><Input type="url" value={v.website ?? ""} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://" /></Field>
          <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={v.isFeatured} onChange={(e) => setV({ ...v, isFeatured: e.target.checked })} className="size-4 accent-[#d7ff3a]" /> Destacado</label>
          <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-[#d7ff3a]" /> Activo (visible en la app)</label>
          <Button type="submit" loading={saving} className="w-full" size="lg">Guardar</Button>
        </form>
      </Sheet>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/misc";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MapView } from "@/components/map/map-view";
import { useToast } from "@/components/providers/toast-provider";
import { useUpload, type UploadedImage } from "@/hooks/use-upload";
import { api, ApiClientError } from "@/lib/api-client";
import { imageUrl } from "@/lib/media";
import { GENRES } from "@/config/taxonomy";
import type { MapConfig } from "@/server/services/map";
import type { OpeningHours } from "@/lib/types";

const DAYS = [
  ["mon", "Lunes"],
  ["tue", "Martes"],
  ["wed", "Miércoles"],
  ["thu", "Jueves"],
  ["fri", "Viernes"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
] as const;

export interface VenueManageValues {
  name: string;
  description: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  phone: string;
  website: string;
  instagram: string;
  priceMin: string;
  priceMax: string;
  minAge: string;
  genres: string[];
  hours: OpeningHours;
  coverKey: string | null;
}

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function VenueManageForm({ venueId, slug, mapConfig, initial }: { venueId: string; slug: string; mapConfig: MapConfig; initial: VenueManageValues }) {
  const [v, setV] = useState(initial);
  // undefined = unchanged, null = removed, string = new uploaded photo.
  const [coverPhotoId, setCoverPhotoId] = useState<string | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { upload, progress } = useUpload();
  const toast = useToast();
  const router = useRouter();
  const set = <K extends keyof VenueManageValues>(key: K, value: VenueManageValues[K]) => setV((s) => ({ ...s, [key]: value }));

  const setDay = (day: string, ranges: Array<{ open: string; close: string }>) => setV((s) => ({ ...s, hours: { ...s.hours, [day]: ranges } }));

  const onCover = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading(true);
    try {
      const img = await upload<UploadedImage>(files[0], "image");
      setCoverPhotoId(img.id);
      set("coverKey", img.key);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const openingHours = Object.fromEntries(DAYS.map(([d]) => [d, (v.hours[d] ?? []).filter((r) => r.open && r.close)]));
    try {
      await api.patch(`/api/venues/${venueId}`, {
        name: v.name,
        description: v.description || null,
        address: v.address,
        neighborhood: v.neighborhood || null,
        lat: v.lat,
        lng: v.lng,
        phone: v.phone || null,
        website: v.website,
        instagram: v.instagram.replace(/^@/, "") || null,
        priceMin: num(v.priceMin),
        priceMax: num(v.priceMax),
        minAge: num(v.minAge),
        genres: v.genres,
        openingHours: Object.values(openingHours).some((d) => d.length) ? openingHours : null,
        coverPhotoId,
      });
      toast("Ficha actualizada");
      router.push(`/venues/${slug}`);
      router.refresh();
    } catch (err) {
      const e = err as ApiClientError;
      setErrors(e.fields ?? {});
      toast(e.message, "error");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => onCover(e.target.files)} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="relative flex aspect-[21/9] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface text-muted hover:bg-surface-2">
          {v.coverKey ? (
            <Image src={imageUrl(v.coverKey, "lg")!} alt="Portada" fill sizes="700px" className="object-cover" />
          ) : uploading ? (
            <>
              <Loader2 className="size-6 animate-spin text-volt" /> <span className="text-sm">{progress ?? 0}%</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-7" />
              <span className="font-semibold text-fg">Añadir foto de portada</span>
            </>
          )}
          {v.coverKey && <span className="glass absolute right-3 bottom-3 rounded-full px-3 py-1.5 text-[13px] font-semibold text-fg">Cambiar portada</span>}
        </button>
        {v.coverKey && (
          <button type="button" onClick={() => (setCoverPhotoId(null), set("coverKey", null))} className="mt-2 flex items-center gap-1 text-sm text-muted">
            <X className="size-4" /> Quitar portada
          </button>
        )}
      </div>

      <Field label="Nombre" htmlFor="name" error={errors.name}>
        <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
      </Field>

      <Field label="Descripción" htmlFor="desc" error={errors.description}>
        <Textarea id="desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} placeholder="Qué música suena, cómo es el ambiente, normas de acceso…" />
      </Field>

      <Field label="Música" hint="Hasta 5 estilos" error={errors.genres}>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const on = v.genres.includes(g.slug);
            return (
              <Chip key={g.slug} active={on} onClick={() => set("genres", on ? v.genres.filter((x) => x !== g.slug) : v.genres.length < 5 ? [...v.genres, g.slug] : v.genres)}>
                {g.name}
              </Chip>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Precio desde (€)" htmlFor="pmin" error={errors.priceMin}>
          <Input id="pmin" inputMode="numeric" value={v.priceMin} onChange={(e) => set("priceMin", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Hasta (€)" htmlFor="pmax" error={errors.priceMax}>
          <Input id="pmax" inputMode="numeric" value={v.priceMax} onChange={(e) => set("priceMax", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Edad mínima" htmlFor="age" error={errors.minAge}>
          <Input id="age" inputMode="numeric" value={v.minAge} onChange={(e) => set("minAge", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </Field>
      </div>

      <section className="space-y-3">
        <h2 className="text-[13px] font-bold tracking-wider text-muted uppercase">Horario</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {DAYS.map(([day, label]) => {
            const ranges = v.hours[day] ?? [];
            return (
              <div key={day} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="w-full shrink-0 text-sm font-semibold sm:w-24">{label}</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {ranges.length === 0 && <span className="text-sm text-muted">Cerrado</span>}
                  {ranges.map((r, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <Input type="time" aria-label={`${label} abre`} value={r.open} onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} className="h-10 w-[6.75rem] px-2.5" />
                      <span className="text-muted">–</span>
                      <Input type="time" aria-label={`${label} cierra`} value={r.close} onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} className="h-10 w-[6.75rem] px-2.5" />
                      <button type="button" aria-label="Quitar franja" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2">
                        <X className="size-4" />
                      </button>
                    </span>
                  ))}
                  {ranges.length < 3 && (
                    <button type="button" onClick={() => setDay(day, [...ranges, { open: "23:00", close: "05:00" }])} className="flex items-center gap-1 text-sm font-semibold text-fg">
                      <Plus className="size-4" /> Franja
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {errors.openingHours && <p className="text-sm text-red-400">{errors.openingHours}</p>}
        <p className="text-[12px] text-faint">Si cierra después de medianoche, pon la hora de cierre del día siguiente (p. ej. 23:00 – 06:00).</p>
      </section>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dirección" htmlFor="addr" error={errors.address}>
            <Input id="addr" value={v.address} onChange={(e) => set("address", e.target.value)} maxLength={160} />
          </Field>
          <Field label="Barrio" htmlFor="hood" error={errors.neighborhood}>
            <Input id="hood" value={v.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} maxLength={60} />
          </Field>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="relative h-56">
            <MapView config={mapConfig} center={{ lat: v.lat, lng: v.lng }} zoom={16} markers={[{ id: "pin", lat: v.lat, lng: v.lng, variant: "discoteca" }]} onMapClick={(p) => setV((s) => ({ ...s, lat: p.lat, lng: p.lng }))} className="size-full" />
          </div>
          <p className="flex items-center gap-1.5 bg-surface px-4 py-2.5 text-[13px] text-muted">
            <MapPin className="size-4" /> Toca el mapa para corregir la ubicación exacta
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
        </Field>
        <Field label="Web" htmlFor="web" error={errors.website}>
          <Input id="web" type="url" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Instagram" htmlFor="ig" error={errors.instagram}>
          <Input id="ig" value={v.instagram} onChange={(e) => set("instagram", e.target.value)} maxLength={60} placeholder="@local" />
        </Field>
      </div>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button type="submit" size="lg" className="w-full shadow-2xl shadow-black" loading={saving} disabled={uploading}>
          Guardar ficha
        </Button>
      </div>
    </form>
  );
}

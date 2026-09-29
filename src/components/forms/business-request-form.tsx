"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/misc";
import { EntityPicker, type PickerOption } from "./entity-picker";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";
import type { Page, VenueCardData } from "@/lib/types";

/** Request an organizer / venue account (reviewed by staff). */
export function BusinessRequestForm() {
  const [type, setType] = useState<"ORGANIZER" | "VENUE">("ORGANIZER");
  const [venue, setVenue] = useState<PickerOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const router = useRouter();
  const toast = useToast();

  const loadVenues = async (q: string) => {
    const r = await api.get<Page<VenueCardData>>(`/api/venues?limit=20${q ? `&q=${encodeURIComponent(q)}` : "&sort=name"}`);
    return r.items.map((v) => ({ id: v.id, title: v.name, subtitle: v.neighborhood ?? (v.address || undefined) }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setFields({});
    try {
      await api.post("/api/me/business", {
        type,
        tradeName: f.get("tradeName"),
        contactEmail: f.get("contactEmail"),
        contactPhone: f.get("contactPhone") || undefined,
        website: f.get("website"),
        venueId: type === "VENUE" ? venue?.id : undefined,
        message: f.get("message") || undefined,
      });
      toast("Solicitud enviada. Te avisaremos cuando la revisemos.");
      router.refresh();
    } catch (err) {
      const e2 = err as ApiClientError;
      setFields(e2.fields ?? {});
      toast(e2.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        <Chip active={type === "ORGANIZER"} onClick={() => setType("ORGANIZER")}>Organizo fiestas</Chip>
        <Chip active={type === "VENUE"} onClick={() => setType("VENUE")}>Gestiono un local</Chip>
      </div>
      {type === "VENUE" && (
        <Field label="Local" error={fields.venueId} hint="¿No aparece? Escríbenos en el mensaje con la dirección y lo añadimos.">
          <EntityPicker label="Elige tu local" placeholder="Busca por nombre" value={venue} onChange={setVenue} load={loadVenues} icon={<Store className="size-4" />} />
        </Field>
      )}
      <Field label={type === "VENUE" ? "Nombre comercial del local" : "Nombre del colectivo / promotora"} htmlFor="tradeName" error={fields.tradeName}>
        <Input id="tradeName" name="tradeName" required minLength={2} maxLength={80} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email de contacto" htmlFor="contactEmail" error={fields.contactEmail}>
          <Input id="contactEmail" name="contactEmail" type="email" maxLength={254} />
        </Field>
        <Field label="Teléfono" htmlFor="contactPhone" error={fields.contactPhone}>
          <Input id="contactPhone" name="contactPhone" type="tel" maxLength={30} />
        </Field>
      </div>
      <Field label="Web o Instagram" htmlFor="website" error={fields.website}>
        <Input id="website" name="website" type="url" maxLength={300} placeholder="https://" />
      </Field>
      <Field label="Mensaje para el equipo" htmlFor="message" error={fields.message} hint="Cómo podemos comprobar que eres tú (web oficial, email del dominio, redes…)">
        <Textarea id="message" name="message" maxLength={500} className="min-h-24" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={saving} disabled={type === "VENUE" && !venue}>
        Enviar solicitud
      </Button>
    </form>
  );
}

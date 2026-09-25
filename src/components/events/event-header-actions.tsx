"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, Pencil, XCircle } from "lucide-react";
import { MoreMenu, type MenuItem } from "@/components/social/more-menu";
import { useReport } from "@/components/social/report-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";

export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      aria-label="Volver"
      className={className ?? "glass pressable grid size-10 place-items-center rounded-full border border-line"}
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}

export function EventHeaderActions({ eventId, slug, canEdit, status }: { eventId: string; slug: string; canEdit: boolean; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const report = useReport();

  const items: MenuItem[] = [];
  if (canEdit) {
    items.push({ label: "Editar evento", icon: <Pencil className="size-4" />, onSelect: () => router.push(`/events/${slug}/edit`) });
    if (status !== "CANCELLED") {
      items.push({
        label: "Cancelar evento",
        danger: true,
        icon: <XCircle className="size-4" />,
        onSelect: async () => {
          if (!confirm("¿Cancelar este evento? Los asistentes lo verán como cancelado.")) return;
          try {
            await api.del(`/api/events/${eventId}`);
            toast("Evento cancelado", "info");
            router.refresh();
          } catch (err) {
            toast((err as ApiClientError).message, "error");
          }
        },
      });
    }
  }
  items.push({ label: "Reportar evento", icon: <Flag className="size-4" />, onSelect: () => report.open("EVENT", eventId) });

  return (
    <>
      <MoreMenu items={items} className="glass border border-line" />
      {report.dialog}
    </>
  );
}

"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";
import { REPORT_REASONS } from "@/config/taxonomy";
import { cn } from "@/lib/cn";

export type ReportTarget = "USER" | "EVENT" | "VENUE" | "POST" | "PHOTO" | "VIDEO" | "COMMENT";

const TARGET_LABEL: Record<ReportTarget, string> = {
  USER: "usuario",
  EVENT: "evento",
  VENUE: "local",
  POST: "publicación",
  PHOTO: "foto",
  VIDEO: "vídeo",
  COMMENT: "comentario",
};

export function useReport() {
  const [target, setTarget] = useState<{ type: ReportTarget; id: string } | null>(null);
  const requireAuth = useRequireAuth();
  const open = (type: ReportTarget, id: string) => requireAuth("Inicia sesión para reportar contenido") && setTarget({ type, id });
  const dialog = <ReportDialog target={target} onClose={() => setTarget(null)} />;
  return { open, dialog };
}

function ReportDialog({ target, onClose }: { target: { type: ReportTarget; id: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!target || !reason) return;
    setLoading(true);
    try {
      const res = await api.post<{ alreadyReported: boolean }>("/api/reports", {
        targetType: target.type,
        targetId: target.id,
        reason,
        details: details || undefined,
      });
      toast(res.alreadyReported ? "Ya habías reportado este contenido" : "Gracias. Nuestro equipo lo revisará.");
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={target !== null} onClose={onClose} title={target ? `Reportar ${TARGET_LABEL[target.type]}` : undefined}>
      <div className="space-y-4 pb-2">
        <p className="text-sm text-muted">¿Qué ocurre? Los reportes son anónimos.</p>
        <div className="grid gap-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={cn("pressable rounded-2xl border px-4 py-3 text-left text-[15px] font-medium", reason === r.value ? "border-volt bg-volt/10" : "border-line bg-surface-2")}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Textarea placeholder="Detalles (opcional)" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} className="min-h-20" />
        <Button onClick={submit} disabled={!reason} loading={loading} className="w-full" size="lg">
          <Flag className="size-4" /> Enviar reporte
        </Button>
      </div>
    </Sheet>
  );
}

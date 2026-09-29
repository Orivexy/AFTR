import { redirect } from "next/navigation";
import { CircleAlert, CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { systemStatus, type ServiceState } from "@/server/services/system-status";
import { SettingsForm } from "@/components/admin/settings-form";
import { isAdmin } from "@/lib/roles";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const ICON: Record<ServiceState, React.ReactNode> = {
  ok: <CircleCheck className="size-5 text-emerald-400" />,
  off: <CircleMinus className="size-5 text-faint" />,
  warn: <CircleAlert className="size-5 text-amber-400" />,
  error: <CircleX className="size-5 text-danger" />,
};
const LABEL: Record<ServiceState, string> = { ok: "Activo", off: "No configurado", warn: "Revisar", error: "Error" };

export default async function AdminSettingsPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) redirect("/admin");
  const [settings, services] = await Promise.all([getSettings(), systemStatus()]);
  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Ajustes</h1>
          <p className="text-sm text-muted">Se aplican al momento, sin reiniciar. Las variables de entorno son los valores por defecto.</p>
        </div>
        <SettingsForm initial={settings} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-bold">Servicios</h2>
          <p className="text-sm text-muted">Qué está configurado en este servidor. Las claves se configuran como variables de entorno y nunca se muestran aquí.</p>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {services.map((s) => (
            <div key={s.name} className="flex gap-3 p-4">
              <span className="mt-0.5 shrink-0">{ICON[s.state]}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                  {s.name}
                  <span className={cn("text-[11px] font-bold tracking-wider uppercase", s.state === "ok" ? "text-emerald-400" : s.state === "error" ? "text-danger" : s.state === "warn" ? "text-amber-400" : "text-faint")}>{LABEL[s.state]}</span>
                </p>
                <p className="text-[13px] break-words text-muted">{s.detail}</p>
                {s.fix && <p className="mt-1 text-[12px] break-words text-faint">Configurar: {s.fix}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

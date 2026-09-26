import Link from "next/link";
import { AdminAction } from "./admin-action";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

/** Shared blocks of /admin/map-data and /admin/event-data. */

export function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold", tone === "warn" && "text-warn", tone === "ok" && "text-volt")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

const when = (d: Date | null | undefined) => (d ? timeAgo(d) : "—");
const inFuture = (d: Date | null | undefined) => {
  if (!d) return "—";
  const min = Math.round((d.getTime() - Date.now()) / 60_000);
  if (min <= 0) return "ahora";
  return min < 60 ? `en ${min} min` : min < 48 * 60 ? `en ${Math.round(min / 60)} h` : `en ${Math.round(min / 1440)} d`;
};

export interface JobView {
  name: string;
  label: string;
  enabled: boolean;
  status: string;
  intervalMin: number;
  defaultIntervalMin: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  nextRunAt: Date | null;
}

export function JobCards({ jobs, canRun }: { jobs: JobView[]; canRun: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {jobs.map((j) => (
        <article key={j.name} className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[13px] font-bold">{j.name}</p>
              <p className="text-[12px] text-muted">{j.label}</p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", j.status === "ERROR" ? "bg-danger/15 text-danger" : j.status === "OK" ? "bg-volt/15 text-volt" : "bg-surface-2 text-muted")}>
              {j.enabled ? j.status : "DESACTIVADO"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-muted">Frecuencia</dt>
            <dd>
              cada {j.intervalMin >= 60 ? `${Math.round(j.intervalMin / 60)} h` : `${j.intervalMin} min`}
              {j.intervalMin !== j.defaultIntervalMin && " (personalizada)"}
            </dd>
            <dt className="text-muted">Último éxito</dt>
            <dd>{when(j.lastSuccessAt)}</dd>
            <dt className="text-muted">Último fallo</dt>
            <dd className={j.lastFailureAt ? "text-warn" : ""}>{when(j.lastFailureAt)}</dd>
            <dt className="text-muted">Próxima ejecución</dt>
            <dd>
              {inFuture(j.nextRunAt)}
              {j.consecutiveFailures > 0 && <span className="text-warn"> · reintento {j.consecutiveFailures} (backoff)</span>}
            </dd>
          </dl>
          {j.lastError && <p className="rounded-xl bg-danger/10 p-2 text-[12px] text-danger">{j.lastError}</p>}
          {canRun && (
            <div className="flex flex-wrap gap-2 pt-1">
              <AdminAction url={`/api/admin/sync-jobs/${j.name}`} method="POST" tone="primary" success="Ejecutado">
                Ejecutar ahora
              </AdminAction>
              <AdminAction url={`/api/admin/sync-jobs/${j.name}`} method="PATCH" body={{ enabled: !j.enabled }} success={j.enabled ? "Desactivado" : "Activado"}>
                {j.enabled ? "Desactivar" : "Activar"}
              </AdminAction>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export interface SourceView {
  id: string;
  name: string;
  type: string;
  city: string;
  enabled: boolean;
  status: string;
  lastError: string | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  nextSyncAt: Date | null;
  consecutiveFailures: number;
  found: number;
  label: string;
  needsKey: boolean;
  policy: { storeContent: boolean; attribution: string } | null;
}

export function SourcesTable({ sources }: { sources: SourceView[] }) {
  if (!sources.length) return <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">Sin fuentes. Añádelas en <Link href="/admin/discovery" className="underline">Event Discovery</Link>.</p>;
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
      {sources.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
          <span className={cn("size-2 rounded-full", !s.enabled ? "bg-faint" : s.status === "ERROR" ? "bg-danger" : "bg-volt")} />
          <span className="font-semibold">{s.name}</span>
          <span className="text-[12px] text-muted">{s.label} · {s.city}</span>
          {s.policy && !s.policy.storeContent && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">solo vincula IDs (condiciones del proveedor)</span>}
          {s.needsKey && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] text-warn">falta API key</span>}
          <span className="ml-auto text-[12px] text-muted">
            {s.found} en la última · éxito {when(s.lastSuccessAt)} · próxima {s.enabled ? inFuture(s.nextSyncAt) : "—"}
            {s.consecutiveFailures > 0 && <span className="text-warn"> · {s.consecutiveFailures} fallos seguidos</span>}
          </span>
          {s.lastError && <p className="w-full text-[12px] text-danger">{s.lastError}</p>}
        </div>
      ))}
    </div>
  );
}

export interface RunView {
  id: string;
  job: string | null;
  status: string;
  startedAt: Date;
  found: number;
  created: number;
  updated: number;
  duplicates: number;
  queued: number;
  deactivated: number;
  errors: number;
  log: string | null;
  source: { name: string } | null;
}

export function RunsList({ runs }: { runs: RunView[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
      {runs.map((r) => (
        <details key={r.id} className="p-3">
          <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn("font-bold", r.status === "ERROR" ? "text-danger" : r.status === "OK" ? "text-volt" : "text-muted")}>{r.status}</span>
            <span className="font-semibold">{r.source?.name ?? r.job}</span>
            {r.job && r.source && <span className="font-mono text-[11px] text-faint">{r.job}</span>}
            {r.source && (
              <span className="text-muted">
                {r.found} leídos · {r.created} nuevos · {r.updated} actualizados · {r.duplicates} duplicados · {r.queued} en revisión · {r.deactivated} desactivados · {r.errors} errores
              </span>
            )}
            <span className="ml-auto text-[12px] text-faint">{timeAgo(r.startedAt)}</span>
          </summary>
          {r.log && <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-surface-2 p-3 text-[12px] whitespace-pre-wrap text-muted">{r.log}</pre>}
        </details>
      ))}
      {!runs.length && <p className="p-6 text-center text-muted">Todavía no hay ejecuciones.</p>}
    </div>
  );
}

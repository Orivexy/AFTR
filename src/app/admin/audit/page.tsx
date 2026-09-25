import { requireAdminPage } from "@/server/auth/guards";
import { listAuditLogs } from "@/server/services/admin-commerce";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Auditoría" };

export default async function AuditPage() {
  await requireAdminPage();
  const logs = await listAuditLogs(200);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Registro de auditoría</h1>
      <p className="text-[13px] text-muted">Operaciones administrativas y comerciales (últimas 200).</p>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
        {logs.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <code className="rounded bg-surface-2 px-2 py-0.5 text-[12px]">{l.action}</code>
            <span className="text-muted">{l.actor?.profile ? `@${l.actor.profile.username}` : "sistema"}</span>
            {l.targetType && <span className="text-faint">{l.targetType} {l.targetId}</span>}
            {l.metadata && <span className="max-w-md truncate text-[12px] text-faint">{JSON.stringify(l.metadata)}</span>}
            <span className="ml-auto text-[12px] text-faint">{timeAgo(l.createdAt)} {l.ipAddress && `· ${l.ipAddress}`}</span>
          </div>
        ))}
        {!logs.length && <p className="p-8 text-center text-muted">Sin registros</p>}
      </div>
    </div>
  );
}

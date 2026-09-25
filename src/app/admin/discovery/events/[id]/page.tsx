import Link from "next/link";
import { notFound } from "next/navigation";
import { eventDiscoveryHistory } from "@/server/services/admin-discovery";
import { AdminAction } from "@/components/admin/admin-action";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Historial del evento" };

export default async function EventHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await eventDiscoveryHistory(id);
  if (!e) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/events?source=IMPORT" className="text-sm text-muted hover:text-fg">← Eventos importados</Link>
        <h1 className="mt-1 font-display text-2xl font-bold">{e.title}</h1>
        <p className="text-sm text-muted">
          {e.status} · {e.trust} · fuente principal: {e.primarySource?.name ?? "—"} · importado {e.importedAt ? timeAgo(e.importedAt) : "—"} · sincronizado {e.lastSyncedAt ? timeAgo(e.lastSyncedAt) : "—"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/events/${e.slug}`} target="_blank" className="inline-flex h-8 items-center rounded-full bg-surface-3 px-3 text-[12px] font-bold">Ver</Link>
          <Link href={`/events/${e.slug}/edit`} className="inline-flex h-8 items-center rounded-full bg-surface-3 px-3 text-[12px] font-bold">Edit</Link>
          <AdminAction url={`/api/admin/events/${e.id}`} body={{ verified: e.trust !== "VERIFIED" }} tone={e.trust === "VERIFIED" ? "default" : "primary"}>
            {e.trust === "VERIFIED" ? "Quitar verificado" : "Mark as verified"}
          </AdminAction>
        </div>
      </div>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Fuentes asociadas</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {e.sourceRecords.map((r) => (
            <div key={r.id} className="flex flex-wrap gap-3 p-3">
              <span className="font-semibold">{r.source.name}</span>
              <span className="text-muted">{r.reviewStatus}</span>
              {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-muted underline">{r.sourceUrl}</a>}
              <span className="ml-auto text-[12px] text-faint">visto {timeAgo(r.lastSeenAt)}{r.missedSyncs > 0 && ` · ${r.missedSyncs} ausencias`}</span>
            </div>
          ))}
          {!e.sourceRecords.length && <p className="p-6 text-center text-muted">Sin fuentes externas</p>}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Cambios</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {e.changes.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              <code className="rounded bg-surface-2 px-2 py-0.5 text-[12px]">{c.field}</code>
              <span className="text-muted line-through">{c.oldValue ?? "—"}</span>
              <span>→ {c.newValue ?? "—"}</span>
              <span className="ml-auto text-[12px] text-faint">{c.source?.name ?? "staff"} · {timeAgo(c.createdAt)}</span>
            </div>
          ))}
          {!e.changes.length && <p className="p-6 text-center text-muted">Sin cambios registrados</p>}
        </div>
      </section>
    </div>
  );
}

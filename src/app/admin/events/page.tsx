import Link from "next/link";
import { adminEvents } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pager } from "@/components/admin/pager";
import { Cover } from "@/components/ui/cover";
import { formatShortDate, formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";

const STATUSES = ["PENDING", "PUBLISHED", "REJECTED", "CANCELLED"] as const;
const LABEL = { PENDING: "Pendientes", PUBLISHED: "Publicados", REJECTED: "Rechazados", CANCELLED: "Cancelados" };

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const { items, nextCursor } = await adminEvents({ status, q: sp.q, cursor: sp.cursor });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Eventos</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/events" className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-semibold", !status ? "bg-fg text-ink" : "border border-line-strong")}>Todos</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/events?status=${s}`} className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-semibold", status === s ? "bg-fg text-ink" : "border border-line-strong")}>
            {LABEL[s]}
          </Link>
        ))}
        <AdminSearch placeholder="Buscar eventos…" />
      </div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((e) => (
          <div key={e.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <Cover imageKey={e.coverKey} alt="" sizes="64px" className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Link href={`/events/${e.slug}`} target="_blank" className="truncate font-semibold hover:underline">{e.title}</Link>
              <p className="truncate text-[13px] text-muted">
                {formatShortDate(e.startsAt, e.timezone)} {formatTime(e.startsAt, e.timezone)} · {e.venue?.name ?? e.locationName} · {e.cityName} · por @{e.organizer.username}
              </p>
              <p className="text-[12px] font-bold">
                <span className={e.status === "PUBLISHED" ? "text-volt" : e.status === "PENDING" ? "text-warn" : "text-danger"}>{e.status}</span>
                {e.isFeatured && <span className="ml-2 text-volt">★ Destacado</span>}
                {e.isDemo && <span className="ml-2 text-faint">DEMO</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.status === "PENDING" && (
                <>
                  <AdminAction url={`/api/admin/events/${e.id}`} body={{ decision: "approve" }} tone="primary" success="Evento aprobado">Aprobar</AdminAction>
                  <AdminAction url={`/api/admin/events/${e.id}`} body={{ decision: "reject" }} tone="danger" success="Evento rechazado">Rechazar</AdminAction>
                </>
              )}
              {e.status === "PUBLISHED" && (
                <AdminAction url={`/api/admin/events/${e.id}`} body={{ featured: !e.isFeatured }} success={e.isFeatured ? "Ya no está destacado" : "Evento destacado"}>
                  {e.isFeatured ? "Quitar destacado" : "Destacar"}
                </AdminAction>
              )}
              <Link href={`/events/${e.slug}/edit`} className="inline-flex h-8 items-center rounded-full bg-surface-3 px-3 text-[12px] font-bold hover:bg-line-strong">Editar</Link>
              <AdminAction url={`/api/admin/events/${e.id}`} method="DELETE" tone="danger" confirm="¿Eliminar definitivamente este evento?" success="Evento eliminado">Eliminar</AdminAction>
            </div>
          </div>
        ))}
        {!items.length && <p className="p-8 text-center text-muted">Sin eventos</p>}
      </div>
      <Pager nextCursor={nextCursor} params={{ status: sp.status, q: sp.q, cursor: sp.cursor }} />
    </div>
  );
}

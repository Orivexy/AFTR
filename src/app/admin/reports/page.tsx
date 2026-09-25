import Link from "next/link";
import Image from "next/image";
import { listReports } from "@/server/services/reports";
import { AdminAction } from "@/components/admin/admin-action";
import { REPORT_REASONS } from "@/config/taxonomy";
import { imageUrl } from "@/lib/media";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

const STATUSES = [
  { value: "OPEN", label: "Abiertos" },
  { value: "RESOLVED", label: "Resueltos" },
  { value: "DISMISSED", label: "Descartados" },
] as const;

const REASON = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));
const TYPE: Record<string, string> = { USER: "Usuario", EVENT: "Evento", VENUE: "Local", POST: "Publicación", PHOTO: "Foto", VIDEO: "Vídeo", COMMENT: "Comentario" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = STATUSES.find((s) => s.value === raw)?.value ?? "OPEN";
  const { items } = await listReports(status, undefined, 50);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Reportes</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link key={s.value} href={`/admin/reports?status=${s.value}`} className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-semibold", status === s.value ? "bg-fg text-ink" : "border border-line-strong")}>
            {s.label}
          </Link>
        ))}
      </div>
      {!items.length && <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">No hay reportes {status === "OPEN" ? "pendientes 🎉" : ""}</p>}
      <div className="space-y-3">
        {items.map((r) => {
          const preview = r.photo?.key ?? r.video?.posterKey ?? null;
          const targetId = r.targetKey.split(":")[1];
          const link =
            r.event ? `/events/${r.event.slug}` : r.venue ? `/venues/${r.venue.slug}` : r.post ? `/social?post=${r.post.id}` : r.video?.postId ? `/social?post=${r.video.postId}` : r.comment ? `/social?post=${r.comment.postId}` : r.user ? `/u/${r.user.username}` : null;
          const title =
            r.event?.title ?? r.venue?.name ?? r.post?.caption ?? (r.comment ? `“${r.comment.body}”` : null) ?? (r.user ? `@${r.user.username}` : null) ?? (r.photo ? `Foto de @${r.photo.uploader.username}` : "Vídeo");
          const owner = r.post?.author ?? r.photo?.uploader ?? r.comment?.author ?? r.user ?? null;
          return (
            <article key={r.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 md:flex-row md:items-center">
              {preview && (
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  <Image src={imageUrl(preview, "sm")!} alt="" fill sizes="64px" className="object-cover" />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 font-bold">{TYPE[r.targetType]}</span>
                  <span className="rounded-full bg-danger/15 px-2 py-0.5 font-bold text-danger">{REASON[r.reason]}</span>
                  {r.openReportsOnTarget > 1 && <span className="font-bold text-warn">{r.openReportsOnTarget} reportes</span>}
                  <span className="text-faint">{timeAgo(r.createdAt)} · por @{r.reporter.username}</span>
                </div>
                <p className="truncate font-semibold">{link ? <Link href={link} target="_blank" className="hover:underline">{title}</Link> : title}</p>
                {owner && <p className="text-[13px] text-muted">Autor: @{owner.username}</p>}
                {r.details && <p className="text-[13px] text-muted">Detalle: {r.details}</p>}
                {r.resolution && <p className="text-[12px] text-faint">Resolución: {r.resolution}</p>}
              </div>
              {status === "OPEN" && (
                <div className="flex flex-wrap gap-2">
                  <AdminAction url={`/api/admin/reports/${r.id}`} method="POST" body={{ action: "dismiss" }} success="Reporte descartado">Descartar</AdminAction>
                  {r.targetType !== "USER" && (
                    <AdminAction url={`/api/admin/reports/${r.id}`} method="POST" body={{ action: "remove" }} tone="danger" confirm="¿Retirar este contenido?" success="Contenido retirado">Retirar</AdminAction>
                  )}
                  {(owner || r.targetType === "USER") && (
                    <AdminAction url={`/api/admin/reports/${r.id}`} method="POST" body={{ action: "suspend" }} tone="danger" confirm="¿Suspender al autor? Se cerrarán sus sesiones." success="Usuario suspendido">Suspender autor</AdminAction>
                  )}
                </div>
              )}
              {status !== "OPEN" && targetId && r.targetType !== "USER" && (
                <AdminAction url={`/api/admin/reports/${r.id}`} method="POST" body={{ action: "restore" }} success="Contenido restaurado">Restaurar</AdminAction>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

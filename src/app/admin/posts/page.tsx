import Link from "next/link";
import Image from "next/image";
import { adminPosts } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/admin-action";
import { Pager } from "@/components/admin/pager";
import { imageUrl } from "@/lib/media";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

const STATUSES = ["VISIBLE", "HIDDEN", "REMOVED"] as const;
const LABEL = { VISIBLE: "Visibles", HIDDEN: "Ocultas (reportes)", REMOVED: "Retiradas" };

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ status?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const { items, nextCursor } = await adminPosts({ status, cursor: sp.cursor });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Publicaciones</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/posts" className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-semibold", !status ? "bg-fg text-ink" : "border border-line-strong")}>Todas</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/posts?status=${s}`} className={cn("h-9 rounded-full px-4 text-[13px] leading-9 font-semibold", status === s ? "bg-fg text-ink" : "border border-line-strong")}>{LABEL[s]}</Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <article key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Link href={`/social?post=${p.id}`} target="_blank" className="relative block aspect-[4/5] bg-surface-2">
              {p.thumbKey && <Image src={imageUrl(p.thumbKey, "sm")!} alt="" fill sizes="240px" className="object-cover" />}
              <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold">{p.type}</span>
              {p._count.reports > 0 && <span className="absolute top-2 right-2 rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">{p._count.reports} rep.</span>}
            </Link>
            <div className="space-y-2 p-3">
              <p className="truncate text-[13px]"><b>@{p.author.username}</b> · {timeAgo(p.createdAt)}</p>
              <p className="line-clamp-2 min-h-8 text-[12px] text-muted">{p.caption}</p>
              <p className={cn("text-[11px] font-bold", p.status === "VISIBLE" ? "text-volt" : "text-danger")}>{p.status}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.status !== "VISIBLE" && <AdminAction url={`/api/admin/posts/${p.id}`} body={{ status: "VISIBLE" }} success="Publicación visible">Restaurar</AdminAction>}
                {p.status !== "REMOVED" && <AdminAction url={`/api/admin/posts/${p.id}`} body={{ status: "REMOVED" }} tone="danger" confirm="¿Retirar esta publicación?" success="Publicación retirada">Retirar</AdminAction>}
              </div>
            </div>
          </article>
        ))}
      </div>
      <Pager nextCursor={nextCursor} params={{ status: sp.status, cursor: sp.cursor }} />
    </div>
  );
}

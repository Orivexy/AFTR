import Link from "next/link";
import { adminUsers } from "@/server/services/admin";
import { getSessionUser } from "@/server/auth/session";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pager } from "@/components/admin/pager";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/time";
import { ROLE_LABEL } from "@/lib/roles";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const me = await getSessionUser();
  const { items, nextCursor } = await adminUsers(sp.q, sp.cursor);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Usuarios</h1>
        <AdminSearch placeholder="Email, usuario o nombre…" />
      </div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <Avatar user={{ displayName: u.profile?.displayName ?? u.email, avatarKey: u.profile?.avatarKey ?? null }} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {u.profile ? <Link href={`/u/${u.profile.username}`} target="_blank" className="hover:underline">{u.profile.displayName} <span className="text-muted">@{u.profile.username}</span></Link> : u.email}
              </p>
              <p className="truncate text-[13px] text-muted">
                {u.email} · alta {timeAgo(u.createdAt)} · {u.profile?.followerCount ?? 0} seguidores · {u.profile?.postCount ?? 0} posts · {u._count.events} eventos
                {u._count.reportsAgainst > 0 && <span className="text-warn"> · {u._count.reportsAgainst} reportes</span>}
              </p>
              <p className="text-[12px] font-bold">
                <span className={u.role === "USER" ? "text-faint" : "text-volt"}>{ROLE_LABEL[u.role]}</span>
                {u.status === "SUSPENDED" && <span className="ml-2 text-danger">SUSPENDIDO</span>}
              </p>
            </div>
            {u.id !== me?.id && (
              <div className="flex flex-wrap gap-2">
                {u.status === "ACTIVE" ? (
                  <AdminAction url={`/api/admin/users/${u.id}`} body={{ suspended: true }} tone="danger" confirm="¿Suspender esta cuenta?" success="Cuenta suspendida">Suspender</AdminAction>
                ) : (
                  <AdminAction url={`/api/admin/users/${u.id}`} body={{ suspended: false }} success="Cuenta reactivada">Reactivar</AdminAction>
                )}
                {me?.role === "ADMIN" && u.role === "USER" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ role: "MODERATOR" }} success="Ahora es moderador">Hacer moderador</AdminAction>}
                {me?.role === "ADMIN" && u.role === "MODERATOR" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ role: "USER" }} success="Rol retirado">Quitar moderador</AdminAction>}
              </div>
            )}
          </div>
        ))}
      </div>
      <Pager nextCursor={nextCursor} params={{ q: sp.q, cursor: sp.cursor }} />
    </div>
  );
}

import Link from "next/link";
import { adminVenues } from "@/server/services/admin";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pager } from "@/components/admin/pager";
import { VenueEditor } from "@/components/admin/venue-editor";
import { Cover } from "@/components/ui/cover";

export default async function AdminVenuesPage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const { items, nextCursor } = await adminVenues(sp.q, sp.cursor);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Locales</h1>
        <AdminSearch placeholder="Buscar locales…" />
      </div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((v) => (
          <div key={v.id} className="flex items-center gap-3 p-3">
            <Cover imageKey={v.coverKey} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Link href={`/venues/${v.slug}`} target="_blank" className="truncate font-semibold hover:underline">{v.name}</Link>
              <p className="truncate text-[13px] text-muted">{v.neighborhood ?? v.address} · {v.city.name} · ★ {v.ratingAvg.toFixed(1)} ({v.ratingCount}) · {v.followerCount} seguidores</p>
              <p className="text-[12px] font-bold">
                {v.isActive ? <span className="text-volt">ACTIVO</span> : <span className="text-danger">INACTIVO</span>}
                {v.isFeatured && <span className="ml-2 text-volt">★ Destacado</span>}
              </p>
            </div>
            <VenueEditor venue={v} />
          </div>
        ))}
      </div>
      <Pager nextCursor={nextCursor} params={{ q: sp.q, cursor: sp.cursor }} />
    </div>
  );
}

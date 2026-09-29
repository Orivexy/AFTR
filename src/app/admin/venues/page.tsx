import Link from "next/link";
import { adminVenues } from "@/server/services/admin";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pager } from "@/components/admin/pager";
import { VenueEditor } from "@/components/admin/venue-editor";
import { Cover } from "@/components/ui/cover";
import { SimpleForm } from "@/components/admin/simple-form";
import { listCities } from "@/server/services/cities";

export default async function AdminVenuesPage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const [{ items, nextCursor }, cities] = await Promise.all([adminVenues(sp.q, sp.cursor), listCities()]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Locales</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch placeholder="Buscar locales…" />
          <SimpleForm
            trigger="Añadir local"
            title="Nuevo local"
            url="/api/admin/venues"
            submitLabel="Crear local"
            note="Para locales que ninguna fuente conoce todavía. Se crea como verificado; después puedes completar la ficha desde “Gestionar ficha”."
            fields={[
              { name: "name", label: "Nombre", required: true },
              { name: "citySlug", label: "Ciudad", type: "select", required: true, options: cities.map((c) => ({ value: c.slug, label: c.name })) },
              {
                name: "type",
                label: "Tipo",
                type: "select",
                required: true,
                defaultValue: "CLUB",
                options: [
                  { value: "CLUB", label: "Discoteca" },
                  { value: "BAR", label: "Bar musical" },
                  { value: "CONCERT_HALL", label: "Sala de conciertos" },
                  { value: "OPEN_AIR", label: "Open air" },
                  { value: "OTHER", label: "Otro" },
                ],
              },
              { name: "address", label: "Dirección", required: true },
              { name: "neighborhood", label: "Barrio" },
              { name: "lat", label: "Latitud", type: "decimal", required: true, placeholder: "41.3874" },
              { name: "lng", label: "Longitud", type: "decimal", required: true, placeholder: "2.1686" },
              { name: "website", label: "Web", type: "url" },
            ]}
          />
        </div>
      </div>
      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
          {sp.q ? "Ningún local coincide con la búsqueda." : "Todavía no hay locales. Se añaden al sincronizar las fuentes (Admin → Descubrimiento) o a mano."}
        </p>
      )}
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
            <Link href={`/venues/${v.slug}/manage`} className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold hover:bg-surface-3">Ficha</Link>
            <VenueEditor venue={v} />
          </div>
        ))}
      </div>
      <Pager nextCursor={nextCursor} params={{ q: sp.q, cursor: sp.cursor }} />
    </div>
  );
}

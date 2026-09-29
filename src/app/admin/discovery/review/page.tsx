import Link from "next/link";
import { reviewQueue } from "@/server/services/admin-discovery";
import { RecordReview } from "@/components/admin/record-review";
import { AdminAction } from "@/components/admin/admin-action";
import { formatPrice } from "@/lib/money";
import { formatLongDate, formatTime, timeAgo, utcToLocalParts } from "@/lib/time";
import type { NormalizedEvent } from "@/server/discovery/types";
import type { ProviderPlace } from "@/server/places/types";

export const metadata = { title: "Revisión · Event Discovery" };

export default async function ReviewPage() {
  const { events, venues, cityVenues, duplicates } = await reviewQueue();
  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/discovery" className="text-sm text-muted hover:text-fg">← Event Discovery</Link>
        <h1 className="mt-1 font-display text-2xl font-bold">Pendientes de revisión</h1>
        <p className="text-sm text-muted">Eventos y locales que no pasaron los controles de calidad o vienen de fuentes con revisión manual.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Eventos ({events.length})</h2>
        {events.map((r) => {
          const n = r.data as unknown as NormalizedEvent;
          const start = new Date(n.startsAt);
          const local = utcToLocalParts(start, n.timezone);
          const dup = r.duplicateOfId ? duplicates.get(r.duplicateOfId) ?? null : null;
          return (
            <article key={r.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-display text-lg font-semibold">{n.title}</p>
                  <p className="text-sm text-muted">
                    📅 {formatLongDate(start, n.timezone)} · 🕐 {n.timeUnknown ? "Hora no especificada" : formatTime(start, n.timezone)}
                    {n.endsAt && ` — ${formatTime(new Date(n.endsAt), n.timezone)}`} · 📍 {n.locationName ?? n.address ?? "Lugar no especificado"} · 💶 {formatPrice(n.priceMin, n.priceMax, n.currency ?? "EUR")}
                    {n.genres.length > 0 && ` · 🎵 ${n.genres.join(", ")}`}
                  </p>
                  <p className="text-[12px] text-faint">
                    {r.source.name} · importado {timeAgo(r.importedAt)} {r.sourceUrl && <>· <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">origen</a></>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.reviewReasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-warn/10 px-2.5 py-1 text-[12px] font-semibold text-warn">{reason}</span>
                ))}
                {dup && <Link href={`/events/${dup.slug}`} target="_blank" className="rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-semibold hover:underline">Ver posible duplicado</Link>}
              </div>
              <RecordReview
                recordId={r.id}
                duplicateOf={dup}
                venues={cityVenues.filter((v) => v.cityId === r.source.city.id)}
                initial={{
                  title: n.title,
                  date: local.date,
                  startTime: n.timeUnknown ? "" : local.time,
                  endTime: n.endsAt ? utcToLocalParts(new Date(n.endsAt), n.timezone).time : "",
                  venueId: n.venueId,
                  locationName: n.locationName ?? "",
                  address: n.address ?? "",
                  lat: n.lat?.toString() ?? "",
                  lng: n.lng?.toString() ?? "",
                  price: n.priceMin == null ? "" : String(n.priceMin / 100),
                }}
              />
            </article>
          );
        })}
        {!events.length && <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">No hay eventos pendientes 🎉</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Locales ({venues.length})</h2>
        {venues.map((r) => {
          const n = r.data as unknown as Partial<ProviderPlace>;
          const googleOnly = r.source.type === "GOOGLE_PLACES";
          return (
            <article key={r.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                {googleOnly ? (
                  <p className="font-semibold">
                    Lugar de Google ·{" "}
                    <a href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.externalId)}`} target="_blank" rel="noopener noreferrer" className="underline">
                      ver en Google Maps
                    </a>
                  </p>
                ) : (
                  <p className="font-semibold">{n.name ?? "Sin nombre"}</p>
                )}
                {!googleOnly && (
                  <p className="text-sm text-muted">{n.address || "Dirección no disponible"} {n.phone && `· ${n.phone}`} {n.website && <>· <a href={n.website} target="_blank" rel="noopener noreferrer" className="underline">web</a></>} {n.sourceUrl && <>· <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">fuente</a></>}</p>
                )}
                <p className="text-[12px] text-faint">{r.source.name} · {r.reviewReasons.join(" · ")}{r.expiresAt && " · datos con caducidad (proveedor)"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!googleOnly && <AdminAction url={`/api/admin/discovery/venue-records/${r.id}`} method="POST" body={{ action: "approve" }} tone="primary" success="Local creado">Aprobar</AdminAction>}
                <AdminAction url={`/api/admin/discovery/venue-records/${r.id}`} method="POST" body={{ action: "reject" }} tone="danger" success="Rechazado">Rechazar</AdminAction>
                <AdminAction url={`/api/admin/discovery/venue-records/${r.id}`} method="POST" body={{ action: "delete" }} success="Eliminado">Eliminar</AdminAction>
              </div>
            </article>
          );
        })}
        {!venues.length && <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">No hay locales pendientes</p>}
      </section>
    </div>
  );
}

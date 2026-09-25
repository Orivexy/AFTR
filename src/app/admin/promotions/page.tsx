import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { listPromotions } from "@/server/services/admin-commerce";
import { monetizationFlags } from "@/server/monetization/flags";
import { AdminAction } from "@/components/admin/admin-action";
import { SimpleForm } from "@/components/admin/simple-form";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Contenido patrocinado" };

const TYPE_LABEL = { FEATURED_EVENT: "Evento destacado", FEATURED_VENUE: "Local destacado", SPONSORED_POST: "Publicación patrocinada", AD: "Publicidad" } as const;

export default async function PromotionsPage() {
  await requireAdminPage();
  const items = await listPromotions();
  const canActivate = monetizationFlags.sponsored || monetizationFlags.ads;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Contenido patrocinado</h1>
        <SimpleForm
          trigger="Nueva promoción"
          title="Nueva promoción (borrador)"
          url="/api/admin/promotions"
          note="Se crea como borrador. Mientras la publicidad y el contenido patrocinado estén desactivados no se puede activar."
          fields={[
            { name: "type", label: "Tipo", type: "select", required: true, options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })) },
            { name: "target", label: "Contenido", required: true, hint: "Slug del evento o del local, o id de la publicación" },
            { name: "placement", label: "Ubicación", type: "select", options: ["HOME", "DISCOVER", "FEED", "SEARCH", "MAP"].map((v) => ({ value: v, label: v })) },
            { name: "startsAt", label: "Inicio", type: "date" },
            { name: "endsAt", label: "Fin", type: "date" },
            { name: "budgetCents", label: "Presupuesto (€)", type: "number" },
            { name: "notes", label: "Notas" },
          ]}
        />
      </div>
      <p className="text-[13px] text-muted">El contenido promocionado se etiqueta siempre de forma visible (“Destacado”, “Patrocinado” o “Publicidad”). Los destacados editoriales gratuitos se gestionan en Eventos.</p>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((p) => {
          const target = p.event ? <Link href={`/events/${p.event.slug}`} target="_blank" className="hover:underline">{p.event.title}</Link> : p.venue ? <Link href={`/venues/${p.venue.slug}`} target="_blank" className="hover:underline">{p.venue.name}</Link> : p.post ? <Link href={`/social?post=${p.post.id}`} target="_blank" className="hover:underline">{p.post.caption ?? "Publicación"}</Link> : "—";
          return (
            <div key={p.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{TYPE_LABEL[p.type]} · {target}</p>
                <p className="text-[13px] text-muted">
                  {p.status} · {p.placement ?? "sin ubicación"} {p.budgetCents != null && `· ${formatMoney(p.budgetCents, p.currency)}`} · {p.business?.tradeName ?? "sin negocio"} · creada {timeAgo(p.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {canActivate && p.status === "DRAFT" && <AdminAction url={`/api/admin/promotions/${p.id}`} body={{ action: "activate" }} tone="primary">Activar</AdminAction>}
                {p.status !== "REJECTED" && p.status !== "ACTIVE" && <AdminAction url={`/api/admin/promotions/${p.id}`} body={{ action: "reject" }}>Rechazar</AdminAction>}
                {p.status !== "ACTIVE" && <AdminAction url={`/api/admin/promotions/${p.id}`} body={{ action: "delete" }} tone="danger" confirm="¿Eliminar la promoción?">Eliminar</AdminAction>}
              </div>
            </div>
          );
        })}
        {!items.length && <p className="p-8 text-center text-muted">Sin promociones</p>}
      </div>
    </div>
  );
}

import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { listBusinesses } from "@/server/services/admin-commerce";
import { monetizationFlags } from "@/server/monetization/flags";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminSearch } from "@/components/admin/admin-search";
import { SimpleForm } from "@/components/admin/simple-form";
import { ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/cn";

export const metadata = { title: "Negocios" };

const VERIFICATION_TONE: Record<string, string> = { VERIFIED: "text-volt", PENDING: "text-warn", REJECTED: "text-danger", UNVERIFIED: "text-faint" };

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q } = await searchParams;
  const items = await listBusinesses(q);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Organizadores y locales</h1>
        <div className="flex items-center gap-2">
          <AdminSearch placeholder="Nombre o usuario…" />
          <SimpleForm
            trigger="Nuevo negocio"
            title="Nuevo negocio"
            url="/api/admin/businesses"
            note="El usuario pasará a tener rol Organizador o Local (sin permisos de administración)."
            fields={[
              { name: "username", label: "Usuario propietario", required: true, placeholder: "sala_x" },
              { name: "type", label: "Tipo", type: "select", required: true, options: [{ value: "ORGANIZER", label: "Organizador" }, { value: "VENUE", label: "Local / discoteca" }] },
              { name: "tradeName", label: "Nombre comercial", required: true },
              { name: "venueSlug", label: "Slug del local (solo tipo local)", placeholder: "sala-x" },
              { name: "contactEmail", label: "Email de contacto", type: "email" },
              { name: "contactPhone", label: "Teléfono" },
              { name: "website", label: "Web", type: "url" },
            ]}
          />
        </div>
      </div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((b) => (
          <div key={b.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-semibold">
                {b.tradeName} <span className="text-[12px] font-normal text-muted">· {b.type === "VENUE" ? "Local" : "Organizador"}</span>
              </p>
              <p className="truncate text-[13px] text-muted">
                @{b.owner.profile?.username} ({ROLE_LABEL[b.owner.role]}) · {b.contactEmail ?? b.owner.email}
                {b.contactPhone && ` · ${b.contactPhone}`}
                {b.venue && <> · <Link href={`/venues/${b.venue.slug}`} target="_blank" className="hover:underline">{b.venue.name}</Link></>}
              </p>
              <p className="text-[12px]">
                <span className={cn("font-bold", VERIFICATION_TONE[b.verification])}>{b.verification}</span>
                <span className="ml-2 text-muted">Estado comercial: {b.commercialStatus}</span>
                <span className="ml-2 text-muted">Plan: {b.plan}</span>
                <span className="ml-2 text-faint">{b._count.events} eventos · {b._count.subscriptions} suscripciones · {b._count.transactions} operaciones · {b._count.promotions} promociones</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.verification !== "VERIFIED" && <AdminAction url={`/api/admin/businesses/${b.id}`} body={{ verification: "VERIFIED" }} tone="primary" success="Negocio verificado">Verificar</AdminAction>}
              {b.verification !== "REJECTED" && <AdminAction url={`/api/admin/businesses/${b.id}`} body={{ verification: "REJECTED" }} tone="danger" success="Verificación rechazada">Rechazar</AdminAction>}
              {b.commercialStatus !== "SUSPENDED" ? (
                <AdminAction url={`/api/admin/businesses/${b.id}`} body={{ commercialStatus: "SUSPENDED" }} tone="danger" confirm="¿Suspender la actividad comercial?" success="Suspendido">Suspender</AdminAction>
              ) : (
                <AdminAction url={`/api/admin/businesses/${b.id}`} body={{ commercialStatus: "INACTIVE" }} success="Reactivado">Reactivar</AdminAction>
              )}
              {monetizationFlags.premium && b.plan === "PLAN_FREE" && <AdminAction url={`/api/admin/businesses/${b.id}`} body={{ plan: "PLAN_PREMIUM" }}>Premium</AdminAction>}
            </div>
          </div>
        ))}
        {!items.length && <p className="p-8 text-center text-muted">Sin negocios</p>}
      </div>
      {!monetizationFlags.premium && <p className="text-[12px] text-faint">Los cambios de plan están bloqueados mientras los planes premium estén desactivados.</p>}
    </div>
  );
}

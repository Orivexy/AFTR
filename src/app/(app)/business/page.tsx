import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Clock, XCircle } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { listOwnBusinesses } from "@/server/monetization/business";
import { BusinessRequestForm } from "@/components/forms/business-request-form";
import { BackButton } from "@/components/events/event-header-actions";
import { AdminAction } from "@/components/admin/admin-action";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Organizadores y locales" };

export default async function BusinessPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/business");
  const items = await listOwnBusinesses(user.id);
  const pending = items.some((b) => b.verification === "PENDING");

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 pt-4 pb-16 md:pt-10">
      <div className="flex items-center gap-3">
        <BackButton className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2" />
        <h1 className="font-display text-2xl font-bold">Organizadores y locales</h1>
      </div>
      <p className="text-muted">
        Con una cuenta verificada tus eventos se publican al momento y aparecen como <b className="text-fg">Oficial</b>. Si gestionas un local, podrás editar su ficha: horarios, fotos, descripción y enlaces.
      </p>

      {items.length > 0 && (
        <section className="space-y-3">
          {items.map((b) => (
            <article key={b.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{b.tradeName}</p>
                  <p className="text-[13px] text-muted">
                    {b.type === "VENUE" ? "Local" : "Organizador"}
                    {(b.venue ?? b.requestedVenue) && ` · ${(b.venue ?? b.requestedVenue)!.name}`} · enviada {timeAgo(b.createdAt)}
                  </p>
                </div>
                {b.verification === "VERIFIED" ? (
                  <span className="flex items-center gap-1 text-[13px] font-bold text-volt"><BadgeCheck className="size-4" /> Verificado</span>
                ) : b.verification === "REJECTED" ? (
                  <span className="flex items-center gap-1 text-[13px] font-bold text-danger"><XCircle className="size-4" /> Rechazada</span>
                ) : (
                  <span className="flex items-center gap-1 text-[13px] font-bold text-warn"><Clock className="size-4" /> En revisión</span>
                )}
              </div>
              {b.reviewNote && <p className="rounded-xl bg-surface-2 p-3 text-sm">{b.reviewNote}</p>}
              <div className="flex flex-wrap gap-2">
                {b.verification === "VERIFIED" && b.venue && (
                  <Link href={`/venues/${b.venue.slug}/manage`} className={buttonClass("primary", "sm")}>Gestionar ficha del local</Link>
                )}
                {b.verification === "VERIFIED" && (
                  <Link href={b.venue ? `/events/new?venue=${b.venue.id}` : "/events/new"} className={buttonClass("secondary", "sm")}>Crear evento oficial</Link>
                )}
                {b.verification === "PENDING" && (
                  <AdminAction url={`/api/me/business/${b.id}`} method="DELETE" confirm="¿Retirar la solicitud?" success="Solicitud retirada">Retirar solicitud</AdminAction>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {!pending && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{items.length ? "Nueva solicitud" : "Solicitar cuenta"}</h2>
          <BusinessRequestForm />
        </section>
      )}
    </div>
  );
}

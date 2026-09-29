import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getVenueDetail } from "@/server/services/venues";
import { getMapConfig } from "@/server/services/map";
import { BackButton } from "@/components/events/event-header-actions";
import { VenueManageForm } from "@/components/forms/venue-manage-form";

export const metadata: Metadata = { title: "Gestionar local" };

export default async function ManageVenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/venues/${slug}/manage`);
  const venue = await getVenueDetail(slug, user);
  if (!venue) notFound();
  if (!venue.viewer.canManage) redirect(`/venues/${slug}`);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 md:pt-10">
      <div className="mb-6 flex items-center gap-3">
        <BackButton className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">Gestionar ficha</h1>
          <p className="truncate text-sm text-muted">{venue.name}</p>
        </div>
      </div>
      <p className="mb-6 rounded-2xl bg-surface px-4 py-3 text-[13px] text-muted">
        Los datos que guardes aquí son oficiales: las fuentes externas ya no los sobrescriben. Cada cambio queda registrado.
      </p>
      <VenueManageForm
        venueId={venue.id}
        slug={venue.slug}
        mapConfig={getMapConfig()}
        initial={{
          name: venue.name,
          description: venue.description ?? "",
          address: venue.address ?? "",
          neighborhood: venue.neighborhood ?? "",
          lat: venue.lat,
          lng: venue.lng,
          phone: venue.phone ?? "",
          website: venue.website ?? "",
          instagram: venue.instagram ?? "",
          priceMin: venue.priceMin?.toString() ?? "",
          priceMax: venue.priceMax?.toString() ?? "",
          minAge: venue.minAge?.toString() ?? "",
          genres: venue.genres.map((g) => g.slug),
          hours: venue.openingHours ?? {},
          coverKey: venue.coverKey,
        }}
      />
    </div>
  );
}

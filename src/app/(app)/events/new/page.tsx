import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EventForm } from "@/components/forms/event-form";
import { BackButton } from "@/components/events/event-header-actions";
import { getSessionUser } from "@/server/auth/session";
import { getCurrentCity } from "@/server/services/cities";
import { venueOptions } from "@/server/services/venues";
import { getMapConfig } from "@/server/services/map";
import { env } from "@/server/env";
import { nightWindow, utcToLocalParts } from "@/lib/time";

export const metadata: Metadata = { title: "Crear evento" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ venue?: string }> }) {
  const { venue: venueParam } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/events/new");
  const city = await getCurrentCity();
  const venues = await venueOptions(city.id);
  const preset = venues.find((v) => v.id === venueParam);
  const today = utcToLocalParts(new Date(nightWindow(city.timezone).from.getTime() + 12 * 3600_000), city.timezone).date;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 md:pt-10">
      <div className="mb-6 flex items-center gap-3">
        <BackButton className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2" />
        <h1 className="font-display text-2xl font-bold">Crear evento</h1>
      </div>
      <EventForm
        mode="create"
        citySlug={city.slug}
        cityName={city.name}
        venues={venues}
        mapConfig={getMapConfig()}
        moderationNotice={env.EVENT_MODERATION !== "off"}
        initial={{
          title: "",
          description: "",
          category: preset ? "discoteca" : "fiesta",
          genres: [],
          venueId: preset?.id ?? null,
          locationName: preset?.name ?? "",
          address: preset?.address ?? "",
          lat: preset?.lat ?? city.lat,
          lng: preset?.lng ?? city.lng,
          date: today,
          startTime: "23:00",
          endTime: "05:00",
          isFree: true,
          price: "",
          minAge: "",
          ticketUrl: "",
          cover: null,
        }}
      />
    </div>
  );
}

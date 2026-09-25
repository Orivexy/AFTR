import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/forms/post-composer";
import { BackButton } from "@/components/events/event-header-actions";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Publicar" };

export default async function CreatePostPage({ searchParams }: { searchParams: Promise<{ type?: string; event?: string; venue?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/create/post")}`);

  const [event, venue] = await Promise.all([
    sp.event ? db.event.findFirst({ where: { id: sp.event.slice(0, 40), status: "PUBLISHED" }, select: { id: true, title: true, locationName: true, venueId: true, venue: { select: { id: true, name: true } } } }) : null,
    sp.venue ? db.venue.findFirst({ where: { id: sp.venue.slice(0, 40), isActive: true }, select: { id: true, name: true } }) : null,
  ]);
  const v = venue ?? event?.venue ?? null;

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 md:pt-10">
      <div className="mb-6 flex items-center gap-3">
        <BackButton className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2" />
        <h1 className="font-display text-2xl font-bold">Nueva publicación</h1>
      </div>
      <PostComposer
        type={sp.type === "video" ? "video" : "photo"}
        initialEvent={event ? { id: event.id, title: event.title, subtitle: event.locationName } : null}
        initialVenue={v ? { id: v.id, title: v.name } : null}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getProfile, listFollows } from "@/server/services/users";
import { FollowList } from "@/components/social/follow-list";
import { BackButton } from "@/components/events/event-header-actions";

export const metadata = { title: "Siguiendo" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getSessionUser();
  const profile = await getProfile(decodeURIComponent(username), user?.id);
  if (!profile) notFound();
  const initial = await listFollows(profile.id, "following", user?.id);
  return (
    <div className="mx-auto max-w-xl px-4 pt-4 md:pt-10">
      <div className="mb-4 flex items-center gap-3">
        <BackButton className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2" />
        <div>
          <h1 className="font-display text-xl font-bold">Siguiendo</h1>
          <p className="text-sm text-muted">@{profile.username}</p>
        </div>
      </div>
      <FollowList initial={initial} url={`/api/users/${profile.id}/following`} empty="Todavía no sigue a nadie" />
    </div>
  );
}

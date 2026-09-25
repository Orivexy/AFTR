import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCities } from "@/server/services/cities";
import { ProfileForm } from "@/components/forms/profile-form";
import { BackButton } from "@/components/events/event-header-actions";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");
  const [profile, cities] = await Promise.all([
    db.profile.findUniqueOrThrow({ where: { userId: user.id }, select: { bio: true, city: { select: { slug: true } } } }),
    listCities(),
  ]);
  return (
    <div className="mx-auto max-w-lg px-4 pt-4 md:pt-10">
      <div className="mb-6 flex items-center gap-3">
        <BackButton className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2" />
        <h1 className="font-display text-2xl font-bold">Editar perfil</h1>
      </div>
      <ProfileForm
        email={user.email}
        cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
        initial={{ username: user.username, displayName: user.displayName, bio: profile.bio ?? "", avatarKey: user.avatarKey, citySlug: profile.city?.slug ?? "barcelona" }}
      />
    </div>
  );
}

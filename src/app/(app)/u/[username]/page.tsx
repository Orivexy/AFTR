import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getProfile } from "@/server/services/users";
import { listPosts } from "@/server/services/posts";
import { ProfileHeader } from "@/components/social/profile-header";
import { ProfileTabs } from "@/components/social/profile-tabs";
import { imageUrl } from "@/lib/media";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await getProfile(username);
  if (!p) return { title: "Perfil" };
  const img = imageUrl(p.avatarKey, "lg");
  return { title: `${p.displayName} (@${p.username})`, description: p.bio ?? undefined, openGraph: img ? { images: [img] } : undefined };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const user = await getSessionUser();
  const profile = await getProfile(decodeURIComponent(username), user?.id);
  if (!profile) notFound();
  const posts = await listPosts({ authorId: profile.id, viewerId: user?.id, limit: 12 });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 md:pt-10">
      <ProfileHeader profile={profile} />
      {!profile.viewer.blocked && !profile.viewer.blockedBy && <ProfileTabs userId={profile.id} isSelf={profile.viewer.isSelf} initialPosts={posts} />}
    </div>
  );
}

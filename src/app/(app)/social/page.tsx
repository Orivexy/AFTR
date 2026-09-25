import type { Metadata } from "next";
import { VerticalFeed } from "@/components/feed/vertical-feed";
import { getFeed, getPost } from "@/server/services/posts";
import { getCurrentCity } from "@/server/services/cities";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Social" };

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ tab?: string; post?: string }> }) {
  const { tab, post: postId } = await searchParams;
  const mode = tab === "following" ? "following" : "foryou";
  const [user, city] = await Promise.all([getSessionUser(), getCurrentCity()]);
  const [initial, pinned] = await Promise.all([
    getFeed({ mode, viewerId: user?.id, cityId: city.id, limit: 6 }),
    postId && postId.length < 40 ? getPost(postId, user?.id) : null,
  ]);
  return <VerticalFeed key={`${mode}:${postId ?? ""}`} initial={initial} mode={mode} pinned={pinned} />;
}

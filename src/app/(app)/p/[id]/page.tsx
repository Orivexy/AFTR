import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPost } from "@/server/services/posts";
import { imageUrl } from "@/lib/media";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return {};
  const img = imageUrl(post.video?.posterKey ?? post.photos[0]?.key ?? null, "lg");
  return {
    title: post.caption ?? `Publicación de @${post.author.username}`,
    openGraph: img ? { images: [img] } : undefined,
  };
}

/** Shareable permalink: opens the feed pinned at this post. */
export default async function PostPermalink({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();
  redirect(`/social?post=${post.id}`);
}

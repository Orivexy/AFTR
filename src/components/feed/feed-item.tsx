"use client";

import { site } from "@/config/site";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, CalendarDays, Flag, Heart, MapPin, MessageCircle, Share2, Trash2, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SponsorBadge } from "@/components/ui/misc";
import { MoreMenu, type MenuItem } from "@/components/social/more-menu";
import { shareLink } from "@/components/social/share-button";
import { useReport } from "@/components/social/report-dialog";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiClientError } from "@/lib/api-client";
import { compactNumber } from "@/lib/text";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { FeedVideo } from "./feed-video";
import { PhotoCarousel } from "./photo-carousel";
import { CommentsSheet } from "./comments-sheet";
import type { FeedPost } from "@/lib/types";

interface Props {
  post: FeedPost;
  active: boolean;
  nearby: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onChange: (p: FeedPost) => void;
  onRemove: (id: string) => void;
}

export function FeedItem({ post, active, nearby, muted, onToggleMute, onChange, onRemove }: Props) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const report = useReport();
  const router = useRouter();

  const setLike = async (liked: boolean) => {
    if (!requireAuth("Inicia sesión para dar like")) return;
    if (post.viewer.liked === liked) return;
    const optimistic = { ...post, likeCount: post.likeCount + (liked ? 1 : -1), viewer: { ...post.viewer, liked } };
    onChange(optimistic);
    try {
      const res = await api.put<{ liked: boolean; likeCount: number }>(`/api/posts/${post.id}/like`, { liked });
      onChange({ ...optimistic, likeCount: res.likeCount });
    } catch (err) {
      onChange(post);
      toast((err as ApiClientError).message, "error");
    }
  };

  const doubleTapLike = () => {
    setBurst(Date.now());
    void setLike(true);
  };

  const toggleSave = async () => {
    if (!requireAuth("Inicia sesión para guardar publicaciones")) return;
    const saved = !post.viewer.saved;
    onChange({ ...post, saveCount: post.saveCount + (saved ? 1 : -1), viewer: { ...post.viewer, saved } });
    try {
      await api.put(`/api/posts/${post.id}/save`, { saved });
      toast(saved ? "Guardado" : "Eliminado de guardados", "info");
    } catch (err) {
      onChange(post);
      toast((err as ApiClientError).message, "error");
    }
  };

  const follow = async () => {
    if (!requireAuth("Inicia sesión para seguir a gente")) return;
    onChange({ ...post, viewer: { ...post.viewer, followsAuthor: true } });
    try {
      await api.put(`/api/users/${post.author.id}/follow`, { following: true });
      toast(`Ahora sigues a @${post.author.username}`);
    } catch (err) {
      onChange(post);
      toast((err as ApiClientError).message, "error");
    }
  };

  const menu: MenuItem[] = post.viewer.isAuthor
    ? [{
        label: "Eliminar publicación",
        danger: true,
        icon: <Trash2 className="size-4" />,
        onSelect: async () => {
          if (!confirm("¿Eliminar esta publicación?")) return;
          try {
            await api.del(`/api/posts/${post.id}`);
            onRemove(post.id);
            toast("Publicación eliminada", "info");
            router.refresh();
          } catch (err) {
            toast((err as ApiClientError).message, "error");
          }
        },
      }]
    : [
        { label: "Reportar publicación", icon: <Flag className="size-4" />, onSelect: () => report.open(post.video ? "VIDEO" : "POST", post.video?.id ?? post.id) },
        { label: "Reportar usuario", icon: <Flag className="size-4" />, onSelect: () => report.open("USER", post.author.id) },
      ];

  return (
    <article className="relative size-full overflow-hidden bg-black md:rounded-[1.5rem]" aria-label={`Publicación de ${post.author.displayName}`}>
      {post.video ? (
        <FeedVideo videoKey={post.video.key} posterKey={post.video.posterKey} active={active} mounted={nearby} muted={muted} onDoubleTap={doubleTapLike} />
      ) : (
        <PhotoCarousel photos={post.photos} priority={active} onDoubleTap={doubleTapLike} />
      )}

      {burst > 0 && (
        <Heart key={burst} className="animate-pop pointer-events-none absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 text-heart drop-shadow-2xl" fill="currentColor" onAnimationEnd={() => setBurst(0)} />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />

      {/* Right action rail */}
      <div className="absolute right-2 bottom-24 z-10 flex flex-col items-center gap-4 md:bottom-8">
        <RailButton label={post.viewer.liked ? "Quitar like" : "Me gusta"} count={post.likeCount} active={post.viewer.liked} onClick={() => setLike(!post.viewer.liked)}>
          <Heart className={cn("size-7", post.viewer.liked && "animate-pop text-heart")} fill={post.viewer.liked ? "currentColor" : "none"} />
        </RailButton>
        <RailButton label="Comentarios" count={post.commentCount} onClick={() => setCommentsOpen(true)}>
          <MessageCircle className="size-7" />
        </RailButton>
        <RailButton label={post.viewer.saved ? "Quitar de guardados" : "Guardar"} count={post.saveCount} active={post.viewer.saved} onClick={toggleSave}>
          <Bookmark className={cn("size-7", post.viewer.saved && "text-volt")} fill={post.viewer.saved ? "currentColor" : "none"} />
        </RailButton>
        <RailButton label="Compartir" onClick={() => shareLink(`/p/${post.id}`, post.caption ?? `Mira esto en ${site.name}`, toast)}>
          <Share2 className="size-6" />
        </RailButton>
        <MoreMenu items={menu} className="size-11 bg-black/25 text-white" />
      </div>

      {/* Mute toggle for videos */}
      {post.video && (
        <button onClick={onToggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"} className="absolute top-16 right-3 grid size-10 place-items-center rounded-full bg-black/35 backdrop-blur md:top-4">
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      )}

      {/* Author + caption */}
      <div className="absolute inset-x-0 bottom-0 space-y-2.5 p-4 pr-20 pb-6 md:pb-6">
        <div className="flex items-center gap-2.5">
          <Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar user={post.author} size={38} className="ring-2 ring-white/80" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">@{post.author.username}</span>
              <span className="block text-[12px] text-white/70">{timeAgo(post.createdAt)}</span>
            </span>
          </Link>
          {!post.viewer.isAuthor && !post.viewer.followsAuthor && (
            <button onClick={follow} className="pressable ml-1 h-7 rounded-full border border-white/70 px-3 text-[12px] font-bold">
              Seguir
            </button>
          )}
          <SponsorBadge type={post.promotionType} className="ml-auto" />
        </div>
        {post.caption && <p className="line-clamp-3 text-[15px] leading-snug">{post.caption}</p>}
        {post.tagged.length > 0 && (
          <p className="text-[13px] text-white/80">
            con {post.tagged.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ", "}
                <Link href={`/u/${t.username}`} className="font-semibold">@{t.username}</Link>
              </span>
            ))}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {post.event && (
            <Link href={`/events/${post.event.slug}`} className="pressable glass flex max-w-full items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold">
              <CalendarDays className="size-3.5 shrink-0 text-volt" /> <span className="truncate">{post.event.title}</span>
            </Link>
          )}
          {post.venue ? (
            <Link href={`/venues/${post.venue.slug}`} className="pressable glass flex max-w-full items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold">
              <MapPin className="size-3.5 shrink-0 text-volt" /> <span className="truncate">{post.venue.name}</span>
            </Link>
          ) : (
            post.locationName && !post.event && (
              <span className="glass flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold">
                <MapPin className="size-3.5 text-volt" /> {post.locationName}
              </span>
            )
          )}
        </div>
      </div>

      <CommentsSheet
        postId={post.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCountChange={(d) => onChange({ ...post, commentCount: Math.max(0, post.commentCount + d) })}
      />
      {report.dialog}
    </article>
  );
}

function RailButton({ children, count, label, onClick, active }: { children: React.ReactNode; count?: number; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active} className="pressable flex flex-col items-center gap-1 text-white drop-shadow-[0_2px_6px_rgb(0_0_0/0.5)]">
      {children}
      {count !== undefined && <span className="text-[12px] font-bold">{compactNumber(count)}</span>}
    </button>
  );
}

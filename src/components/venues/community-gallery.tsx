"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Flag, Heart, ImagePlus, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useReport } from "@/components/social/report-dialog";
import { useInfinite } from "@/hooks/use-infinite";
import { useUpload, type UploadedImage } from "@/hooks/use-upload";
import { api, ApiClientError } from "@/lib/api-client";
import { imageUrl } from "@/lib/media";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { GalleryPhoto, Page } from "@/lib/types";

export function CommunityGallery({ venueId, initial }: { venueId: string; initial: Page<GalleryPhoto> }) {
  const { items, setItems, hasMore, loading, loadMore } = useInfinite(initial, (c) => `/api/venues/${venueId}/photos?cursor=${c}`);
  const [viewer, setViewer] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const requireAuth = useRequireAuth();
  const user = useSession();
  const toast = useToast();
  const { upload, progress } = useUpload();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const f of Array.from(files).slice(0, 6)) uploaded.push(await upload<UploadedImage>(f, "image"));
      await api.post(`/api/venues/${venueId}/photos`, { photoIds: uploaded.map((u) => u.id) });
      const now = new Date();
      setItems((prev) => [
        ...uploaded.map((u) => ({ id: u.id, key: u.key, width: u.width, height: u.height, blurDataUrl: u.blurDataUrl, createdAt: now, likeCount: 0, liked: false, uploader: user })),
        ...prev,
      ]);
      toast(uploaded.length > 1 ? `${uploaded.length} fotos publicadas` : "Foto publicada");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-display text-[19px] font-semibold md:text-[22px]">Fotos de la comunidad</h2>
        <Button variant="secondary" size="sm" disabled={uploading} onClick={() => requireAuth("Inicia sesión para subir fotos") && input.current?.click()}>
          {uploading ? <><Loader2 className="size-4 animate-spin" /> {progress != null ? `${progress}%` : "Procesando"}</> : <><ImagePlus className="size-4" /> Subir fotos</>}
        </Button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      {items.length ? (
        <div className="grid grid-cols-3 gap-1 md:grid-cols-4 md:gap-2">
          {items.map((p, i) => (
            <button key={p.id} onClick={() => setViewer(i)} className="group pressable relative aspect-square overflow-hidden rounded-lg bg-surface-2 md:rounded-xl">
              <Image src={imageUrl(p.key, "sm")!} alt={`Foto de ${p.uploader.displayName}`} fill sizes="(min-width: 768px) 200px, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" placeholder={p.blurDataUrl ? "blur" : "empty"} blurDataURL={p.blurDataUrl ?? undefined} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Camera className="size-5" />} title="Aún no hay fotos">Comparte cómo se vive la noche aquí.</EmptyState>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>Ver más fotos</Button>
        </div>
      )}
      {viewer !== null && items[viewer] && (
        <Lightbox
          photo={items[viewer]}
          onClose={() => setViewer(null)}
          onPrev={viewer > 0 ? () => setViewer(viewer - 1) : undefined}
          onNext={viewer < items.length - 1 ? () => setViewer(viewer + 1) : undefined}
          onChange={(p) => setItems((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
        />
      )}
    </section>
  );
}

function Lightbox({ photo, onClose, onPrev, onNext, onChange }: { photo: GalleryPhoto; onClose: () => void; onPrev?: () => void; onNext?: () => void; onChange: (p: GalleryPhoto) => void }) {
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const report = useReport();

  const like = async () => {
    if (!requireAuth("Inicia sesión para dar like")) return;
    const liked = !photo.liked;
    onChange({ ...photo, liked, likeCount: photo.likeCount + (liked ? 1 : -1) });
    try {
      const res = await api.put<{ liked: boolean; likeCount: number }>(`/api/photos/${photo.id}/like`, { liked });
      onChange({ ...photo, ...res });
    } catch (err) {
      onChange(photo);
      toast((err as ApiClientError).message, "error");
    }
  };

  return (
    <div className="animate-fade-in fixed inset-0 z-[95] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Foto">
      <div className="safe-top flex items-center gap-3 p-4">
        <Link href={`/u/${photo.uploader.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar user={photo.uploader} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{photo.uploader.displayName}</p>
            <p className="text-[12px] text-muted">{timeAgo(photo.createdAt)}</p>
          </div>
        </Link>
        <button onClick={onClose} aria-label="Cerrar" className="pressable grid size-10 place-items-center rounded-full bg-white/10">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1">
        <Image src={imageUrl(photo.key, "lg")!} alt="" fill sizes="100vw" className="object-contain" placeholder={photo.blurDataUrl ? "blur" : "empty"} blurDataURL={photo.blurDataUrl ?? undefined} />
        {onPrev && <button aria-label="Anterior" onClick={onPrev} className="absolute inset-y-0 left-0 w-1/3" />}
        {onNext && <button aria-label="Siguiente" onClick={onNext} className="absolute inset-y-0 right-0 w-1/3" />}
      </div>
      <div className="safe-bottom flex items-center justify-between p-4">
        <button onClick={like} aria-pressed={photo.liked} className="pressable flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 font-semibold">
          <Heart className={cn("size-5", photo.liked && "animate-pop text-heart")} fill={photo.liked ? "currentColor" : "none"} />
          {photo.likeCount}
        </button>
        <button onClick={() => report.open("PHOTO", photo.id)} className="pressable flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted hover:text-fg">
          <Flag className="size-4" /> Reportar
        </button>
      </div>
      {report.dialog}
    </div>
  );
}

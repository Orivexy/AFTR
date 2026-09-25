"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, Clapperboard, Loader2, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EntityPicker, type PickerOption } from "./entity-picker";
import { UserTagger } from "./user-tagger";
import { useToast } from "@/components/providers/toast-provider";
import { useUpload, type UploadedImage, type UploadedVideo } from "@/hooks/use-upload";
import { api, ApiClientError } from "@/lib/api-client";
import { imageUrl } from "@/lib/media";
import { formatRelativeDay } from "@/lib/time";
import { cn } from "@/lib/cn";

interface Props {
  type: "photo" | "video";
  initialEvent: PickerOption | null;
  initialVenue: PickerOption | null;
}

export function PostComposer({ type: initialType, initialEvent, initialVenue }: Props) {
  const [type, setType] = useState(initialType);
  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [caption, setCaption] = useState("");
  const [event, setEvent] = useState(initialEvent);
  const [venue, setVenue] = useState(initialVenue);
  const [tagged, setTagged] = useState<Array<{ id: string; username: string; displayName: string; avatarKey: string | null }>>([]);
  const [location, setLocation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { upload, progress } = useUpload();
  const toast = useToast();
  const router = useRouter();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      if (type === "video") {
        setVideo(await upload<UploadedVideo>(files[0]!, "video"));
      } else {
        for (const f of Array.from(files).slice(0, 10 - photos.length)) {
          const img = await upload<UploadedImage>(f, "image");
          setPhotos((p) => [...p, img]);
        }
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const { id } = await api.post<{ id: string }>("/api/posts", {
        caption: caption.trim() || undefined,
        photoIds: type === "photo" ? photos.map((p) => p.id) : [],
        videoId: type === "video" ? video?.id : undefined,
        eventId: event?.id,
        venueId: venue?.id,
        taggedUsernames: tagged.map((t) => t.username),
        locationName: location.trim() || undefined,
      });
      toast("¡Publicado!");
      router.push(`/social?post=${id}`);
      router.refresh();
    } catch (err) {
      toast((err as ApiClientError).message, "error");
      setPublishing(false);
    }
  };

  const loadEvents = useCallback(async (q: string) => {
    const r = await api.get<{ items: Array<{ id: string; title: string; startsAt: string; locationName: string }>; timezone: string }>(`/api/events/tag-options?q=${encodeURIComponent(q)}`);
    return r.items.map((e) => ({ id: e.id, title: e.title, subtitle: `${formatRelativeDay(new Date(e.startsAt), r.timezone)} · ${e.locationName}` }));
  }, []);
  const loadVenues = useCallback(async (q: string) => {
    const r = await api.get<{ items: Array<{ id: string; name: string; neighborhood: string | null; address: string }> }>(`/api/venues?limit=40&sort=name`);
    const t = q.toLowerCase();
    return r.items.filter((v) => v.name.toLowerCase().includes(t)).map((v) => ({ id: v.id, title: v.name, subtitle: v.neighborhood ?? v.address }));
  }, []);

  const hasMedia = type === "video" ? Boolean(video) : photos.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 rounded-full bg-surface p-1">
        {(["photo", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={uploading || (t !== type && (photos.length > 0 || Boolean(video)))}
            onClick={() => setType(t)}
            className={cn("flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold disabled:opacity-40", type === t ? "bg-fg text-ink" : "text-muted")}
          >
            {t === "photo" ? <Camera className="size-4" /> : <Clapperboard className="size-4" />}
            {t === "photo" ? "Foto" : "Vídeo"}
          </button>
        ))}
      </div>

      {/* Media */}
      <input
        ref={input}
        type="file"
        hidden
        multiple={type === "photo"}
        accept={type === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp,image/avif"}
        onChange={(e) => onFiles(e.target.files)}
      />
      {type === "video" && video ? (
        <div className="relative mx-auto aspect-[9/16] w-48 overflow-hidden rounded-2xl bg-surface-2">
          {video.posterUrl && <Image src={video.posterUrl} alt="" fill sizes="200px" className="object-cover" />}
          <button type="button" onClick={() => setVideo(null)} aria-label="Quitar vídeo" className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/60">
            <X className="size-4" />
          </button>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-bold">
            {video.durationSec ? `${Math.round(video.durationSec)} s` : "Vídeo"}
          </span>
        </div>
      ) : type === "photo" && photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-2">
              <Image src={imageUrl(p.key, "sm")!} alt="" fill sizes="150px" className="object-cover" />
              <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} aria-label="Quitar foto" className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60">
                <X className="size-3.5" />
              </button>
              {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold">Portada</span>}
            </div>
          ))}
          {photos.length < 10 && (
            <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="grid aspect-[4/5] place-items-center rounded-xl border border-dashed border-line-strong text-muted hover:bg-surface">
              {uploading ? <span className="text-sm">{progress ?? 0}%</span> : <Plus className="size-6" />}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface text-muted hover:bg-surface-2"
        >
          {uploading ? (
            <>
              <Loader2 className="size-7 animate-spin text-volt" />
              <span className="text-sm">{progress != null && progress < 100 ? `Subiendo ${progress}%` : type === "video" ? "Optimizando vídeo…" : "Procesando…"}</span>
            </>
          ) : (
            <>
              <span className="grid size-14 place-items-center rounded-2xl bg-volt text-on-volt">{type === "video" ? <Clapperboard className="size-6" /> : <Camera className="size-6" />}</span>
              <span className="font-semibold text-fg">{type === "video" ? "Elige un vídeo" : "Elige fotos"}</span>
              <span className="text-[13px]">{type === "video" ? "MP4, MOV o WebM · máx. 90 s" : "Hasta 10 fotos · JPG, PNG o WebP"}</span>
            </>
          )}
        </button>
      )}

      <Field label="Descripción">
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder="Anoche en Gràcia 🔥" className="min-h-24" />
      </Field>

      <div className="space-y-3">
        <EntityPicker label="Fiesta" placeholder="Etiquetar fiesta o evento" value={event} onChange={setEvent} load={loadEvents} icon={<CalendarDays className="size-5" />} />
        <EntityPicker label="Discoteca / local" placeholder="Etiquetar local" value={venue} onChange={setVenue} load={loadVenues} icon={<MapPin className="size-5" />} />
        <UserTagger value={tagged} onChange={setTagged} />
        <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="Ubicación (opcional), ej. Gràcia" aria-label="Ubicación" />
      </div>

      <Button size="lg" className="w-full" disabled={!hasMedia || uploading} loading={publishing} onClick={publish}>
        Publicar
      </Button>
    </div>
  );
}

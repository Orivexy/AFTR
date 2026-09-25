"use client";

import { useState } from "react";
import { Loader2, Pencil, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/field";
import { StarInput } from "./star-input";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { useToast } from "@/components/providers/toast-provider";
import { useInfinite } from "@/hooks/use-infinite";
import { api, ApiClientError, reviveDates } from "@/lib/api-client";
import { timeAgo } from "@/lib/time";
import { formatNumber } from "@/lib/text";
import type { Page, ReviewData, VenueDetail } from "@/lib/types";

const ASPECTS = [
  { key: "ambience", label: "Ambiente" },
  { key: "music", label: "Música" },
  { key: "staff", label: "Personal" },
  { key: "price", label: "Precio" },
  { key: "space", label: "Espacio" },
] as const;

type AspectKey = (typeof ASPECTS)[number]["key"];

interface Props {
  venue: Pick<VenueDetail, "id" | "name" | "ratingAvg" | "ratingCount" | "subScores" | "ratingDistribution">;
  myReview: ReviewData | null;
  initial: Page<ReviewData>;
}

export function ReviewsSection({ venue, myReview: initialMine, initial }: Props) {
  const [summary, setSummary] = useState({ avg: venue.ratingAvg, count: venue.ratingCount });
  const [mine, setMine] = useState(initialMine);
  const [open, setOpen] = useState(false);
  const requireAuth = useRequireAuth();
  const { items, setItems, hasMore, loading, loadMore } = useInfinite(initial, (c) => `/api/venues/${venue.id}/reviews?cursor=${c}`);
  const max = Math.max(1, ...venue.ratingDistribution);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-36">
          <p className="font-display text-5xl font-bold">{summary.count ? summary.avg.toFixed(1).replace(".", ",") : "–"}</p>
          <Stars value={summary.avg} size={16} className="mt-1" />
          <p className="mt-1 text-[13px] text-muted">{formatNumber(summary.count)} valoraciones</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2 text-[12px] text-muted">
              <span className="w-2">{n}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-volt" style={{ width: `${(venue.ratingDistribution[n - 1]! / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-1 sm:gap-1 sm:w-40">
          {ASPECTS.map((a) => (
            <div key={a.key} className="flex flex-col items-center text-center sm:flex-row sm:justify-between">
              <span className="text-[11px] text-muted sm:text-[12px]">{a.label}</span>
              <span className="text-[13px] font-bold">{venue.subScores[a.key]?.toFixed(1).replace(".", ",") ?? "–"}</span>
            </div>
          ))}
        </div>
      </div>

      <Button variant={mine ? "outline" : "primary"} className="w-full sm:w-auto" onClick={() => requireAuth("Inicia sesión para valorar este local") && setOpen(true)}>
        {mine ? <><Pencil className="size-4" /> Editar tu valoración</> : <><Star className="size-4" /> Valorar {venue.name}</>}
      </Button>

      <div className="divide-y divide-line">
        {items.map((r) => <ReviewItem key={r.id} review={r} />)}
        {!items.length && <p className="py-6 text-center text-sm text-muted">Sé el primero en valorar este local.</p>}
      </div>
      {hasMore && (
        <Button variant="secondary" size="sm" onClick={loadMore} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Ver más valoraciones"}
        </Button>
      )}

      <ReviewForm
        open={open}
        onClose={() => setOpen(false)}
        venueId={venue.id}
        venueName={venue.name}
        existing={mine}
        onSaved={(review, v) => {
          setMine(review);
          setSummary({ avg: v.ratingAvg, count: v.ratingCount });
          setItems((prev) => [review, ...prev.filter((x) => x.id !== review.id)]);
        }}
      />
    </section>
  );
}

function ReviewItem({ review }: { review: ReviewData }) {
  return (
    <article className="py-4">
      <div className="flex items-center gap-3">
        <Avatar user={review.user} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{review.user.displayName}</p>
          <div className="flex items-center gap-2">
            <Stars value={review.rating} size={12} />
            <span className="text-[12px] text-faint">{timeAgo(review.updatedAt)}</span>
          </div>
        </div>
      </div>
      {review.comment && <p className="mt-2 text-[15px] text-fg/90">“{review.comment}”</p>}
    </article>
  );
}

function ReviewForm({ open, onClose, venueId, venueName, existing, onSaved }: {
  open: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
  existing: ReviewData | null;
  onSaved: (r: ReviewData, venue: { ratingAvg: number; ratingCount: number }) => void;
}) {
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [aspects, setAspects] = useState<Record<AspectKey, number | null>>({
    ambience: existing?.ambience ?? null,
    music: existing?.music ?? null,
    staff: existing?.staff ?? null,
    price: existing?.price ?? null,
    space: existing?.space ?? null,
  });
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      const res = reviveDates(
        await api.put<{ review: ReviewData; venue: { ratingAvg: number; ratingCount: number } }>(`/api/venues/${venueId}/review`, {
          rating,
          ...aspects,
          comment: comment.trim() || undefined,
        }),
      );
      onSaved(res.review, res.venue);
      toast(existing ? "Valoración actualizada" : "¡Gracias por tu valoración!");
      onClose();
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Valorar ${venueName}`}>
      <div className="space-y-6 pb-2">
        <div className="flex flex-col items-center gap-2">
          <StarInput value={rating} onChange={setRating} size={40} label="Puntuación general" />
          <p className="text-sm text-muted">{rating ? ["", "Malo", "Regular", "Bien", "Muy bien", "Increíble"][rating] : "Toca para puntuar"}</p>
        </div>
        <div className="space-y-3">
          {ASPECTS.map((a) => (
            <div key={a.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{a.label}</span>
              <StarInput value={aspects[a.key]} onChange={(v) => setAspects((s) => ({ ...s, [a.key]: v }))} size={24} label={a.label} />
            </div>
          ))}
        </div>
        <Textarea placeholder="Cuéntanos qué tal (opcional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        <p className="text-[12px] text-faint">Solo puedes tener una valoración por local; puedes editarla cuando quieras.</p>
        <Button onClick={save} disabled={!rating} loading={saving} size="lg" className="w-full">
          {existing ? "Guardar cambios" : "Publicar valoración"}
        </Button>
      </div>
    </Sheet>
  );
}

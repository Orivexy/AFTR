import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Cover } from "@/components/ui/cover";
import { SponsorBadge } from "@/components/ui/misc";
import { Distance } from "@/components/ui/distance";
import { formatPrice } from "@/lib/money";
import { formatNumber } from "@/lib/text";
import { cn } from "@/lib/cn";
import type { VenueCardData } from "@/lib/types";
import { VENUE_STATUS_LABEL, VENUE_TYPE_LABEL } from "@/lib/nightlife";

export function RatingPill({ avg, count, className }: { avg: number; count: number; className?: string }) {
  if (!count) return <span className={cn("text-[12px] text-faint", className)}>Sin valoraciones</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-bold", className)}>
      <Star className="size-3.5 text-volt" fill="currentColor" strokeWidth={0} />
      {avg.toFixed(1).replace(".", ",")}
      <span className="font-medium text-faint">({formatNumber(count)})</span>
    </span>
  );
}

export function VenueCard({ venue, className }: { venue: VenueCardData; className?: string }) {
  return (
    <Link href={`/venues/${venue.slug}`} className={cn("group pressable block", className)}>
      <div className="relative">
        <Cover imageKey={venue.coverKey} art="club" alt={venue.name} sizes="(min-width: 768px) 300px, 70vw" className="aspect-[4/3] rounded-[var(--radius-card)] border border-line" />
        <SponsorBadge type={venue.promotionType} className="absolute top-3 left-3" />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{VENUE_TYPE_LABEL[venue.type] ?? "Local"}</span>
        {venue.status !== "OPEN" && (
          <span className="absolute top-3 right-3 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-black">{VENUE_STATUS_LABEL[venue.status] ?? venue.status}</span>
        )}
      </div>
      <div className="space-y-0.5 px-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-display text-[16px] font-semibold">{venue.name}</h3>
          <RatingPill avg={venue.ratingAvg} count={venue.ratingCount} />
        </div>
        <p className="flex items-center gap-1 truncate text-[13px] text-muted">
          <MapPin className="size-3 shrink-0" />
          {[venue.neighborhood, venue.district].filter(Boolean).join(" · ") || venue.address}
          <Distance lat={venue.lat} lng={venue.lng} />
        </p>
        <p className="truncate text-[12px] text-faint">
          {(venue.musicTags.length ? venue.musicTags : venue.genres.map((g) => g.name)).slice(0, 4).join(" · ")}
          {venue.priceMin != null && ` · ${formatPrice(venue.priceMin, venue.priceMax, venue.currency)}`}
        </p>
      </div>
    </Link>
  );
}

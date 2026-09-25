import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Cover } from "@/components/ui/cover";
import { DemoBadge, SponsorBadge } from "@/components/ui/misc";
import { Distance } from "@/components/ui/distance";
import { formatPrice } from "@/lib/money";
import { formatNumber } from "@/lib/text";
import { cn } from "@/lib/cn";
import type { VenueCardData } from "@/lib/types";

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
        <Cover imageKey={venue.coverKey} alt={venue.name} sizes="(min-width: 768px) 300px, 70vw" className="aspect-[4/3] rounded-[var(--radius-card)] border border-line" />
        {venue.isDemo && <DemoBadge className="absolute top-3 right-3" />}
        <SponsorBadge type={venue.promotionType} className="absolute top-3 left-3" />
      </div>
      <div className="space-y-0.5 px-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-display text-[16px] font-semibold">{venue.name}</h3>
          <RatingPill avg={venue.ratingAvg} count={venue.ratingCount} />
        </div>
        <p className="flex items-center gap-1 truncate text-[13px] text-muted">
          <MapPin className="size-3 shrink-0" />
          {venue.neighborhood ?? venue.address}
          <Distance lat={venue.lat} lng={venue.lng} />
        </p>
        <p className="truncate text-[12px] text-faint">
          {venue.genres.map((g) => g.name).join(" · ")}
          {venue.priceMin != null && ` · ${formatPrice(venue.priceMin, venue.priceMax, venue.currency)}`}
        </p>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { Cover } from "@/components/ui/cover";
import { Badge, DemoBadge, LiveDot } from "@/components/ui/misc";
import { Distance } from "@/components/ui/distance";
import { formatPrice } from "@/lib/money";
import { formatRelativeDay, formatTime, isHappeningNow } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { EventCardData } from "@/lib/types";

function PriceTag({ event, className }: { event: EventCardData; className?: string }) {
  const free = event.priceMin === 0 && !event.priceMax;
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold", free ? "bg-volt text-on-volt" : "glass border border-line text-fg", className)}>
      {formatPrice(event.priceMin, event.priceMax, event.currency)}
    </span>
  );
}

/** Large visual card for rails and grids. */
export function EventCard({ event, className, priority, size = "md" }: { event: EventCardData; className?: string; priority?: boolean; size?: "md" | "lg" }) {
  const live = isHappeningNow(event.startsAt, event.endsAt);
  return (
    <Link
      href={`/events/${event.slug}`}
      className={cn(
        "group pressable relative block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface",
        size === "lg" ? "aspect-[4/5] md:aspect-[16/10]" : "aspect-[4/5]",
        className,
      )}
    >
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]">
        <Cover imageKey={event.coverKey} alt={event.title} sizes={size === "lg" ? "(min-width: 768px) 60vw, 90vw" : "(min-width: 768px) 280px, 72vw"} priority={priority} className="size-full" />
      </div>
      <div className="image-fade absolute inset-0" />
      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="glass">
            {event.category.emoji} {event.category.name}
          </Badge>
          {live && (
            <Badge tone="volt">
              <LiveDot className="!bg-on-volt" /> Ahora
            </Badge>
          )}
        </div>
        <PriceTag event={event} />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
        <p className="text-[12px] font-bold tracking-wide text-volt uppercase">
          {formatRelativeDay(event.startsAt, event.timezone)} · {formatTime(event.startsAt, event.timezone)}
          {event.endsAt && ` — ${formatTime(event.endsAt, event.timezone)}`}
        </p>
        <h3 className={cn("font-display leading-tight font-semibold text-balance", size === "lg" ? "text-2xl md:text-3xl" : "text-lg")}>{event.title}</h3>
        <p className="flex items-center gap-1 text-[13px] text-muted">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{event.venue?.name ?? event.locationName}</span>
          <Distance lat={event.lat} lng={event.lng} className="shrink-0" />
        </p>
        <div className="flex items-center justify-between pt-1">
          {event.goingCount + event.interestedCount > 0 ? (
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <Users className="size-3.5" />
              {event.goingCount} van · {event.interestedCount} interesados
            </span>
          ) : (
            <span />
          )}
          {event.isDemo && <DemoBadge />}
        </div>
      </div>
    </Link>
  );
}

/** Compact row — the "¿qué hay hoy?" list. */
export function EventRow({ event, showDay }: { event: EventCardData; showDay?: boolean }) {
  const live = isHappeningNow(event.startsAt, event.endsAt);
  const free = event.priceMin === 0 && !event.priceMax;
  return (
    <Link href={`/events/${event.slug}`} className="group pressable flex items-center gap-3.5 rounded-2xl p-2 -mx-2 hover:bg-surface">
      <Cover imageKey={event.coverKey} alt="" sizes="80px" className="size-[72px] shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px] font-bold tracking-wide uppercase">
          {live ? (
            <span className="flex items-center gap-1.5 text-volt">
              <LiveDot /> Ahora
            </span>
          ) : (
            <span className="text-volt">
              {showDay && `${formatRelativeDay(event.startsAt, event.timezone)} · `}
              {formatTime(event.startsAt, event.timezone)}
            </span>
          )}
          <span className="text-faint">{event.category.name}</span>
        </div>
        <h3 className="truncate text-[15px] leading-snug font-bold">{event.title}</h3>
        <p className="flex items-center gap-1 truncate text-[13px] text-muted">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{event.venue?.name ?? event.locationName}</span>
          <Distance lat={event.lat} lng={event.lng} className="shrink-0" />
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap", free ? "bg-volt/15 text-volt" : "bg-surface-2 text-fg")}>
          {formatPrice(event.priceMin, event.priceMax, event.currency)}
        </span>
        {event.goingCount > 0 && <span className="text-[11px] text-faint">{event.goingCount} van</span>}
      </div>
    </Link>
  );
}

export function EventCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton aspect-[4/5] rounded-[var(--radius-card)]", className)} />;
}

export function EventRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 py-2">
      <div className="skeleton size-[72px] rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

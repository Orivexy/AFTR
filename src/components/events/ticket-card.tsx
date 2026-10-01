import Link from "next/link";
import { MapPin, Ticket } from "lucide-react";
import { Cover } from "@/components/ui/cover";
import { buttonClass } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { formatEventTime, formatRelativeDay, formatTime } from "@/lib/time";
import { TZDate } from "@date-fns/tz";
import type { EventCardData } from "@/lib/types";

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** Photo-first party card with the price and a one-click "Comprar" (the source's ticket page). */
export function TicketCard({ event, priority }: { event: EventCardData; priority?: boolean }) {
  const d = new TZDate(event.startsAt, event.timezone);
  const href = `/events/${event.slug}`;
  const hasPrice = event.priceMin != null;
  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.4rem] border border-line bg-surface transition-transform duration-300 hover:-translate-y-0.5">
      <Link href={href} className="relative block">
        <Cover imageKey={event.coverKey} art={event.category.slug} alt={event.title} sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 80vw" priority={priority} className="aspect-[4/5] w-full" />
        <div className="image-fade absolute inset-0" />
        <span className="absolute top-3 left-3 grid min-w-12 place-items-center rounded-2xl bg-black/55 px-2 py-1.5 text-center leading-none backdrop-blur-md">
          <span className="text-[20px] font-extrabold">{d.getDate()}</span>
          <span className="mt-0.5 text-[10px] font-bold tracking-wider text-volt">{MONTHS[d.getMonth()]}</span>
        </span>
        <div className="absolute inset-x-3 bottom-3">
          <p className="text-[12px] font-bold tracking-wide text-volt uppercase">
            {formatRelativeDay(event.startsAt, event.timezone)} · {formatEventTime(event.startsAt, event.timezone, event.timeUnknown)}
          </p>
          <h3 className="mt-0.5 line-clamp-2 font-display text-[19px] leading-tight font-bold">{event.title}</h3>
          <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-white/75">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.venue?.name ?? event.locationName}</span>
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-2 p-3">
        <span className="min-w-0 truncate text-[15px] font-bold">
          {hasPrice ? (event.priceMin === 0 && !event.priceMax ? "Gratis" : `${event.priceMax && event.priceMax > event.priceMin! ? "Desde " : ""}${formatPrice(event.priceMin, null, event.currency)}`) : <span className="text-[13px] font-medium text-muted">Precio en la web</span>}
        </span>
        {event.ticketUrl ? (
          <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("primary", "sm", "ml-auto shrink-0")}>
            <Ticket className="size-4" /> Comprar
          </a>
        ) : (
          <Link href={href} className={buttonClass("secondary", "sm", "ml-auto shrink-0")}>
            Ver fiesta
          </Link>
        )}
      </div>
    </article>
  );
}

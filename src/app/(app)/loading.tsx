import { EventCardSkeleton, EventRowSkeleton } from "@/components/events/event-card";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 md:px-6 md:pt-10">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-12 w-full max-w-xl rounded-full" />
      </div>
      <EventCardSkeleton className="aspect-[4/5] md:aspect-[16/7]" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => <EventRowSkeleton key={i} />)}
      </div>
    </div>
  );
}

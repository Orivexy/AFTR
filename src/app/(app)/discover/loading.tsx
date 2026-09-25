import { EventCardSkeleton } from "@/components/events/event-card";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pt-5 md:px-6 md:pt-10">
      <Skeleton className="h-9 w-48" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

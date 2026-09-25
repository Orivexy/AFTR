import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 md:pt-10">
      <div className="flex items-center gap-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
      </div>
    </div>
  );
}

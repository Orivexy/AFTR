import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl md:px-6 md:pt-6">
      <Skeleton className="aspect-[4/5] w-full rounded-none sm:aspect-[16/9] md:aspect-[21/9] md:rounded-[1.75rem]" />
      <div className="grid gap-8 px-4 pt-6 md:grid-cols-[1fr_360px] md:px-0">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-44 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}

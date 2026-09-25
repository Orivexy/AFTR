import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 bottom-16 grid place-items-center bg-black md:static md:h-[calc(100dvh-4rem)] md:bg-ink">
      <div className="skeleton absolute inset-0 opacity-40 md:relative md:inset-auto md:aspect-[9/16] md:h-[calc(100%-2rem)] md:rounded-[1.5rem]" />
      <Loader2 className="absolute size-7 animate-spin text-white/60" />
    </div>
  );
}

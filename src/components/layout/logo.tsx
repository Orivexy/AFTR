import Link from "next/link";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-1.5 font-display text-[19px] font-bold tracking-tight", className)} aria-label={`${site.name} — inicio`}>
      <span className="relative grid size-6 place-items-center">
        <span className="absolute inset-0 rounded-full bg-volt transition-transform duration-300 group-hover:scale-110" />
        <span className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-ink" />
      </span>
      {site.name}
    </Link>
  );
}

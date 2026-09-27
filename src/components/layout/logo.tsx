import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

/** Crescent moon + equalizer (night + party). Source: scripts/logo.mjs → public/icons/logo-mark.svg */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-1.5 font-display text-[19px] font-bold tracking-tight", className)} aria-label={`${site.name} — inicio`}>
      <Image src="/icons/logo-mark.svg" alt="" width={26} height={26} unoptimized priority className="-my-1 size-[26px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
      {site.name}
    </Link>
  );
}

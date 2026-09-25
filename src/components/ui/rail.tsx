"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Horizontal snap scroller that bleeds to the screen edge on mobile. */
export function Rail({ children, className, itemClassName }: { children: React.ReactNode[]; className?: string; itemClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className={cn("group/rail relative", className)}>
      <div ref={ref} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:-mx-0 md:scroll-px-0 md:px-0">
        {children.map((child, i) => (
          <div key={i} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </div>
        ))}
      </div>
      {children.length > 3 && (
        <>
          <button onClick={() => scroll(-1)} aria-label="Anterior" className="glass absolute top-1/2 -left-4 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line-strong opacity-0 transition-opacity group-hover/rail:opacity-100 md:grid">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Siguiente" className="glass absolute top-1/2 -right-4 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line-strong opacity-0 transition-opacity group-hover/rail:opacity-100 md:grid">
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </div>
  );
}

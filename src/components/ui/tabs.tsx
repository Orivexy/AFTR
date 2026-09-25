"use client";

import { cn } from "@/lib/cn";

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 border-b border-line", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "relative flex-1 py-3 text-[13px] font-bold tracking-wide uppercase transition-colors",
            value === t.value ? "text-fg" : "text-faint hover:text-muted",
          )}
        >
          {t.label}
          {value === t.value && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-volt" />}
        </button>
      ))}
    </div>
  );
}

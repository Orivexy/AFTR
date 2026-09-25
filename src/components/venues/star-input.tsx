"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function StarInput({ value, onChange, size = 32, label }: { value: number | null; onChange: (v: number) => void; size?: number; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} estrella${i > 1 ? "s" : ""}`}
          onClick={() => onChange(i)}
          className={cn("pressable transition-colors", value != null && i <= value ? "text-volt" : "text-surface-3 hover:text-faint")}
        >
          <Star style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}

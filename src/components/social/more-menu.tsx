"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}

export function MoreMenu({ items, className, label = "Más opciones" }: { items: MenuItem[]; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={label} aria-expanded={open} className={cn("pressable grid size-10 place-items-center rounded-full", className)}>
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div className="animate-fade-up absolute top-11 right-0 z-30 min-w-48 overflow-hidden rounded-2xl border border-line-strong bg-surface-2 py-1 shadow-2xl">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn("flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-surface-3", it.danger && "text-danger")}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

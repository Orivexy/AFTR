"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Full height on mobile (e.g. comments). */
  tall?: boolean;
}

/** Bottom sheet on mobile, centred dialog on desktop. */
export function Sheet({ open, onClose, title, children, className, tall }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Cerrar" className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          "animate-sheet-up md:animate-fade-up relative flex w-full flex-col rounded-t-[1.75rem] border border-line bg-surface shadow-2xl outline-none md:max-w-lg md:rounded-[1.75rem]",
          tall ? "h-[85dvh] md:h-[80dvh]" : "max-h-[90dvh]",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />
        {title && (
          <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2 md:pt-5">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Cerrar" className="pressable -mr-2 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="safe-bottom min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

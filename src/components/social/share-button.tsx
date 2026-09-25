"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/cn";

export async function shareLink(url: string, title: string, toast: (m: string, k?: "success" | "error" | "info") => void) {
  const absolute = new URL(url, window.location.origin).toString();
  if (navigator.share) {
    try {
      await navigator.share({ title, url: absolute });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(absolute);
    toast("Enlace copiado");
  } catch {
    toast("No se pudo copiar el enlace", "error");
  }
}

export function ShareButton({ url, title, className, label = "Compartir", iconOnly }: { url: string; title: string; className?: string; label?: string; iconOnly?: boolean }) {
  const toast = useToast();
  return (
    <button onClick={() => shareLink(url, title, toast)} aria-label={label} className={cn("pressable inline-flex items-center justify-center gap-2 font-semibold", className)}>
      <Share2 className="size-[18px]" />
      {!iconOnly && label}
    </button>
  );
}

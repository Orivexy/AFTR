"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-2xl font-semibold">Algo ha fallado</p>
      <p className="max-w-sm text-muted">Ha ocurrido un error inesperado. Vuelve a intentarlo en unos segundos.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}

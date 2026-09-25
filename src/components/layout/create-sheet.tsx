"use client";

import Link from "next/link";
import { CalendarPlus, Camera, Clapperboard } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

const OPTIONS = [
  { href: "/create/post?type=video", icon: Clapperboard, title: "Publicar vídeo", text: "Hasta 90 s de la pista, el DJ o el after" },
  { href: "/create/post?type=photo", icon: Camera, title: "Publicar foto", text: "Una foto o un carrusel de la noche" },
  { href: "/events/new", icon: CalendarPlus, title: "Crear evento", text: "Una fiesta, una FM, una sesión…" },
];

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Crear">
      <div className="grid gap-2.5 pb-2">
        {OPTIONS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            onClick={onClose}
            className="pressable flex items-center gap-4 rounded-2xl border border-line bg-surface-2 p-4 hover:border-line-strong hover:bg-surface-3"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-volt text-on-volt">
              <o.icon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted">{o.text}</span>
            </span>
          </Link>
        ))}
      </div>
    </Sheet>
  );
}

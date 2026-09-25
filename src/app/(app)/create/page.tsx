import Link from "next/link";
import { CalendarPlus, Camera, Clapperboard } from "lucide-react";

export const metadata = { title: "Crear" };

const OPTIONS = [
  { href: "/create/post?type=video", icon: Clapperboard, title: "Publicar vídeo", text: "Hasta 90 s de la pista, el DJ o el after" },
  { href: "/create/post?type=photo", icon: Camera, title: "Publicar foto", text: "Una foto o un carrusel de la noche" },
  { href: "/events/new", icon: CalendarPlus, title: "Crear evento", text: "Una fiesta, una FM, una sesión…" },
];

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 pt-6 md:pt-12">
      <h1 className="mb-4 font-display text-3xl font-bold">Crear</h1>
      {OPTIONS.map((o) => (
        <Link key={o.href} href={o.href} className="pressable flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 hover:bg-surface-2">
          <span className="grid size-12 place-items-center rounded-xl bg-volt text-on-volt">
            <o.icon className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">{o.title}</span>
            <span className="block text-sm text-muted">{o.text}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

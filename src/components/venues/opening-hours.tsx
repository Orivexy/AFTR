import type { OpeningHours as Hours } from "@/lib/types";
import { DAY_LABELS, WEEK_ORDER, openingStatus, sanitizeHours, todayKey } from "@/lib/hours";
import { cn } from "@/lib/cn";

export { isOpenNow } from "@/lib/hours";

/** "🟢 Abierto ahora · Cierra a las 06:00" / "⚪ Cerrado · Abre hoy a las 23:30". */
export function OpenStatus({ hours, tz, className }: { hours: Hours | null; tz: string; className?: string }) {
  const s = openingStatus(hours, tz);
  if (!s) return null;
  return (
    <p className={cn("flex items-center gap-2 text-sm", className)}>
      <span className={cn("size-2.5 shrink-0 rounded-full", s.open ? "bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400/70" : "bg-faint")} aria-hidden />
      <b className={s.open ? "text-emerald-300" : "text-fg"}>{s.open ? "Abierto ahora" : "Cerrado"}</b>
      <span className="text-muted">· {s.label}</span>
    </p>
  );
}

export function OpeningHours({ hours, tz }: { hours: Hours | null; tz: string }) {
  const clean = sanitizeHours(hours);
  if (!clean) return <p className="text-sm text-muted">Horario no disponible</p>;
  const today = todayKey(tz);
  return (
    <dl className="space-y-1.5 text-sm">
      {WEEK_ORDER.map((key) => {
        const slots = clean[key];
        return (
          <div key={key} className={cn("flex justify-between", key === today ? "font-bold text-fg" : "text-muted")}>
            <dt>{DAY_LABELS[key]}</dt>
            <dd>{slots?.length ? slots.map((s) => (s.open === s.close ? "24 horas" : `${s.open} – ${s.close}`)).join(", ") : "Cerrado"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

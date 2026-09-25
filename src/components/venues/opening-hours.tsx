import type { OpeningHours as Hours } from "@/lib/types";
import { TZDate } from "@date-fns/tz";
import { cn } from "@/lib/cn";

const DAYS = [
  ["mon", "Lunes"],
  ["tue", "Martes"],
  ["wed", "Miércoles"],
  ["thu", "Jueves"],
  ["fri", "Viernes"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
] as const;
const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Is the venue open right now? Handles schedules that close after midnight. */
export function isOpenNow(hours: Hours | null, tz: string, now = new Date()): boolean {
  if (!hours) return false;
  const d = new TZDate(now.getTime(), tz);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const today = hours[KEYS[d.getDay()]!] ?? [];
  const yesterday = hours[KEYS[(d.getDay() + 6) % 7]!] ?? [];
  for (const s of today) {
    const o = toMin(s.open), c = toMin(s.close);
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true;
  }
  for (const s of yesterday) {
    const o = toMin(s.open), c = toMin(s.close);
    if (c <= o && minutes < c) return true;
  }
  return false;
}

function weekdayKey(tz: string, now = new Date()) {
  return KEYS[new TZDate(now.getTime(), tz).getDay()];
}

export function OpeningHours({ hours, tz }: { hours: Hours | null; tz: string }) {
  if (!hours) return <p className="text-sm text-muted">Horario no disponible</p>;
  const todayKey = weekdayKey(tz);
  return (
    <dl className="space-y-1.5 text-sm">
      {DAYS.map(([key, label]) => {
        const slots = hours[key];
        return (
          <div key={key} className={cn("flex justify-between", key === todayKey ? "font-bold text-fg" : "text-muted")}>
            <dt>{label}</dt>
            <dd>{slots?.length ? slots.map((s) => `${s.open} – ${s.close}`).join(", ") : "Cerrado"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

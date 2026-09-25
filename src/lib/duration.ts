/** Parses "30m", "2h", "1d", "45" (minutes) into minutes. Returns fallback on bad input. */
export function parseDurationMinutes(value: string | undefined | null, fallback: number): number {
  if (!value) return fallback;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(m|min|h|d)?$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = (m[2] ?? "m").toLowerCase();
  const minutes = unit === "h" ? n * 60 : unit === "d" ? n * 1440 : n;
  return minutes >= 1 ? Math.round(minutes) : fallback;
}

import { describe, expect, it } from "vitest";
import { dateFilterWindow, formatLongDate, formatRelativeDay, formatTime, isHappeningNow, localToUtc, nightWindow, utcToLocalParts, weekendWindow } from "@/lib/time";

const TZ = "Europe/Madrid";

describe("night windows", () => {
  it("a night runs 06:00 → 06:00 local", () => {
    const w = nightWindow(TZ, 0, new Date("2026-09-25T20:30:00Z")); // Fri 22:30 CEST
    expect(w.from.toISOString()).toBe("2026-09-25T04:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-09-26T04:00:00.000Z");
  });

  it("01:00 on Saturday still belongs to Friday night", () => {
    const w = nightWindow(TZ, 0, new Date("2026-09-25T23:00:00Z")); // Sat 01:00 CEST
    expect(w.from.toISOString()).toBe("2026-09-25T04:00:00.000Z");
  });

  it("weekend window starts on Friday for any weekday", () => {
    const tue = weekendWindow(TZ, new Date("2026-09-22T10:00:00Z"));
    const sun = weekendWindow(TZ, new Date("2026-09-27T10:00:00Z"));
    expect(tue.from.toISOString()).toBe("2026-09-25T04:00:00.000Z");
    expect(sun.from.toISOString()).toBe("2026-09-25T04:00:00.000Z");
    expect(sun.to.toISOString()).toBe("2026-09-28T04:00:00.000Z");
  });

  it("handles the DST change (last Sunday of October)", () => {
    const w = nightWindow(TZ, 0, new Date("2026-10-24T20:00:00Z"));
    expect(w.to.getTime() - w.from.getTime()).toBe(25 * 3600_000);
  });

  it("week window spans 7 nights", () => {
    const w = dateFilterWindow("week", TZ, new Date("2026-09-25T20:30:00Z"));
    expect((w.to.getTime() - w.from.getTime()) / 3600_000).toBe(168);
  });
});

describe("formatting", () => {
  const now = new Date("2026-09-25T20:30:00Z");
  it("formats local dates and times", () => {
    expect(formatLongDate(now, TZ)).toBe("Viernes 25 septiembre");
    expect(formatTime(now, TZ)).toBe("22:30");
  });
  it("relative day labels", () => {
    expect(formatRelativeDay(new Date("2026-09-25T22:00:00Z"), TZ, now)).toBe("Hoy");
    expect(formatRelativeDay(new Date("2026-09-26T21:00:00Z"), TZ, now)).toBe("Mañana");
    expect(formatRelativeDay(new Date("2026-10-01T21:00:00Z"), TZ, now)).toBe("Jue 1 oct");
  });
  it("round-trips local form values", () => {
    const utc = localToUtc("2026-09-25", "22:00", TZ);
    expect(utc.toISOString()).toBe("2026-09-25T20:00:00.000Z");
    expect(utcToLocalParts(utc, TZ)).toEqual({ date: "2026-09-25", time: "22:00" });
  });
  it("detects live events", () => {
    expect(isHappeningNow(new Date("2026-09-25T20:00:00Z"), new Date("2026-09-26T03:00:00Z"), now)).toBe(true);
    expect(isHappeningNow(new Date("2026-09-25T21:00:00Z"), null, now)).toBe(false);
  });
});

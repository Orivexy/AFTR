import { describe, expect, it } from "vitest";
import { hoursFromGooglePeriods, isOpenNow, openIntervals, openingStatus, opensDuring, parseOsmOpeningHours, sanitizeHours, todayKey } from "@/lib/hours";

const TZ = "Europe/Madrid";
// CEST (UTC+2) until 25 Oct 2026, CET (UTC+1) after; CET→CEST on 29 Mar 2026.
const at = (iso: string) => new Date(iso);

const club = { fri: [{ open: "23:00", close: "06:00" }], sat: [{ open: "23:30", close: "06:00" }] };

describe("openingStatus", () => {
  it("Friday 23:00 → 06:00 is still open on Saturday at 03:00", () => {
    const s = openingStatus(club, TZ, at("2026-09-26T01:00:00Z"))!; // Sat 03:00 CEST
    expect(s.open).toBe(true);
    expect(s.label).toBe("Cierra a las 06:00");
    expect(s.todayLabel).toBe("Hoy abierto hasta las 06:00");
    expect(s.closesAt!.toISOString()).toBe("2026-09-26T04:00:00.000Z");
  });

  it("closed on Saturday afternoon, opens tonight", () => {
    const s = openingStatus(club, TZ, at("2026-09-26T15:00:00Z"))!; // Sat 17:00
    expect(s.open).toBe(false);
    expect(s.label).toBe("Abre hoy a las 23:30");
    expect(s.todayLabel).toBe("Hoy de 23:30 a 06:00");
  });

  it("says it already closed today after a night slot ended", () => {
    const s = openingStatus(club, TZ, at("2026-09-26T10:00:00Z"))!; // Sat 12:00, after Fri 23:00 → Sat 06:00
    expect(s.todayLabel).toBe("Hoy de 23:30 a 06:00");
    const sun = openingStatus(club, TZ, at("2026-09-27T10:00:00Z"))!; // Sun 12:00, Sat night ended 06:00
    expect(sun.todayLabel).toBe("Hoy ya ha cerrado");
  });

  it("names the next opening day when it is not today or tomorrow", () => {
    const s = openingStatus(club, TZ, at("2026-09-22T10:00:00Z"))!; // Tue
    expect(s.label).toBe("Abre el viernes a las 23:00");
    expect(s.todayLabel).toBe("Hoy cerrado");
  });

  it("says 'mañana' for the next calendar day", () => {
    const s = openingStatus(club, TZ, at("2026-09-24T10:00:00Z"))!; // Thu
    expect(s.label).toBe("Abre mañana a las 23:00");
  });

  it("Sunday night slot wraps into Monday morning", () => {
    const h = { sun: [{ open: "22:00", close: "04:00" }] };
    expect(isOpenNow(h, TZ, at("2026-09-28T01:00:00Z"))).toBe(true); // Mon 03:00
    expect(isOpenNow(h, TZ, at("2026-09-28T03:00:00Z"))).toBe(false); // Mon 05:00
  });

  it("24/7 is open without closing time", () => {
    const s = openingStatus(parseOsmOpeningHours("24/7"), TZ, at("2026-09-23T12:00:00Z"))!;
    expect(s.open).toBe(true);
    expect(s.closesAt).toBeNull();
    expect(s.label).toBe("Abierto 24 horas");
  });

  it("returns null when hours are unknown (never guessed)", () => {
    expect(openingStatus(null, TZ)).toBeNull();
    expect(openingStatus({}, TZ)).toBeNull();
  });

  it("uses the venue timezone, not the server one", () => {
    // 22:30 UTC on a Friday = 00:30 Saturday in Madrid (open) but 23:30 Friday in London.
    expect(isOpenNow(club, TZ, at("2026-09-25T22:30:00Z"))).toBe(true);
    expect(isOpenNow({ fri: [{ open: "23:45", close: "06:00" }] }, "Europe/London", at("2026-09-25T22:30:00Z"))).toBe(false);
  });
});

describe("daylight saving time", () => {
  it("the night the clocks go back lasts one hour longer (CEST → CET)", () => {
    // Sat 24 Oct 2026 23:00 CEST → Sun 25 Oct 06:00 CET = 8 h.
    const [iv] = openIntervals({ sat: [{ open: "23:00", close: "06:00" }] }, TZ, at("2026-10-24T12:00:00Z"), at("2026-10-25T12:00:00Z"));
    expect(iv!.start.toISOString()).toBe("2026-10-24T21:00:00.000Z");
    expect(iv!.end.toISOString()).toBe("2026-10-25T05:00:00.000Z");
    expect(iv!.end.getTime() - iv!.start.getTime()).toBe(8 * 3600_000);
  });

  it("the night the clocks go forward lasts one hour less (CET → CEST)", () => {
    // Sat 28 Mar 2026 23:00 CET → Sun 29 Mar 06:00 CEST = 6 h.
    const [iv] = openIntervals({ sat: [{ open: "23:00", close: "06:00" }] }, TZ, at("2026-03-28T12:00:00Z"), at("2026-03-29T12:00:00Z"));
    expect(iv!.end.getTime() - iv!.start.getTime()).toBe(6 * 3600_000);
    expect(iv!.end.toISOString()).toBe("2026-03-29T04:00:00.000Z");
  });

  it("status after the change shows local wall-clock times", () => {
    const s = openingStatus({ sat: [{ open: "23:00", close: "06:00" }] }, TZ, at("2026-10-25T02:30:00Z"))!; // 03:30 CET
    expect(s.open).toBe(true);
    expect(s.label).toBe("Cierra a las 06:00");
  });
});

describe("opensDuring / todayKey", () => {
  it("detects a club open tonight within the night window", () => {
    // Friday night window 06:00 Fri → 06:00 Sat.
    expect(opensDuring(club, TZ, at("2026-09-25T04:00:00Z"), at("2026-09-26T04:00:00Z"))).toBe(true);
    expect(opensDuring(club, TZ, at("2026-09-22T04:00:00Z"), at("2026-09-23T04:00:00Z"))).toBe(false);
  });

  it("today key follows the local calendar day", () => {
    expect(todayKey(TZ, at("2026-09-25T22:30:00Z"))).toBe("sat");
  });
});

describe("parseOsmOpeningHours", () => {
  it("parses day ranges, lists and slots after midnight", () => {
    expect(parseOsmOpeningHours("Th-Sa 23:30-05:00; Su 20:00-02:00")).toEqual({
      thu: [{ open: "23:30", close: "05:00" }],
      fri: [{ open: "23:30", close: "05:00" }],
      sat: [{ open: "23:30", close: "05:00" }],
      sun: [{ open: "20:00", close: "02:00" }],
    });
  });

  it("supports extended hours (26:00) and 24:00", () => {
    expect(parseOsmOpeningHours("Fr,Sa 22:00-26:00")).toEqual({ fri: [{ open: "22:00", close: "02:00" }], sat: [{ open: "22:00", close: "02:00" }] });
    expect(parseOsmOpeningHours("Mo 18:00-24:00")).toEqual({ mon: [{ open: "18:00", close: "00:00" }] });
  });

  it("later rules override earlier ones and 'off' closes days", () => {
    expect(parseOsmOpeningHours("Mo-Su 20:00-02:00; Mo,Tu off")).toEqual(
      Object.fromEntries(["wed", "thu", "fri", "sat", "sun"].map((d) => [d, [{ open: "20:00", close: "02:00" }]])),
    );
  });

  it("wraps week ranges like Fr-Mo", () => {
    expect(Object.keys(parseOsmOpeningHours("Fr-Mo 23:00-06:00")!).sort()).toEqual(["fri", "mon", "sat", "sun"]);
  });

  it("ignores public holiday rules but keeps the rest", () => {
    expect(parseOsmOpeningHours("Fr-Sa 23:59-06:00; PH off")).toEqual({ fri: [{ open: "23:59", close: "06:00" }], sat: [{ open: "23:59", close: "06:00" }] });
  });

  it("refuses what it cannot fully understand", () => {
    for (const v of ["Jun-Sep Fr 22:00-04:00", "Fr 22:00+", "sunset-sunrise", "Fr 22:00-04:00 \"only summer\"", "Mo-Fr 25:00-03:00", "", null]) {
      expect(parseOsmOpeningHours(v)).toBeNull();
    }
  });
});

describe("hours from Google periods", () => {
  it("converts periods crossing midnight", () => {
    expect(hoursFromGooglePeriods([{ open: { day: 5, hour: 23, minute: 0 }, close: { day: 6, hour: 6, minute: 0 } }])).toEqual({ fri: [{ open: "23:00", close: "06:00" }] });
  });

  it("sanitizeHours drops malformed slots", () => {
    expect(sanitizeHours({ fri: [{ open: "23:00", close: "6" }] })).toBeNull();
    expect(sanitizeHours({ fri: [{ open: "23:00", close: "06:00" }], foo: [] })).toEqual({ fri: [{ open: "23:00", close: "06:00" }] });
  });
});

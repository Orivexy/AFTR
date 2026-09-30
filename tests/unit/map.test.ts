import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, directionsUrl, eventType, filterPlaces, priceMatches, type MapFilters } from "@/lib/map-filters";
import { parseSearchIntent } from "@/lib/search-intent";
import { formatDistance } from "@/lib/geo";
import type { MapEvent, MapPlace } from "@/lib/types";

const TZ = "Europe/Madrid";
const NOW = new Date("2026-09-25T18:00:00Z"); // Friday 20:00 in Barcelona

const ev = (id: string, startIso: string, extra: Partial<MapEvent> = {}): MapEvent => ({
  id, slug: id, title: id, startsAt: new Date(startIso), endsAt: null, priceMin: null, priceMax: null, category: "fiesta", genres: [], coverKey: null, ticketUrl: null, officialUrl: null, ...extra,
});

const place = (id: string, extra: Partial<MapPlace> = {}): MapPlace => ({
  kind: "venue", id, slug: id, name: id, lat: 41.39, lng: 2.17, coverKey: null, address: "", neighborhood: null, venueType: "CLUB", genres: [],
  ratingAvg: null, ratingCount: null, priceMin: null, priceMax: null, currency: "EUR", timezone: TZ, openingHours: null, events: [], attribution: null, ...extra,
});

const f = (x: Partial<MapFilters>): MapFilters => ({ ...DEFAULT_FILTERS, ...x });
const ids = (r: ReturnType<typeof filterPlaces>) => r.map((x) => x.place.id);

describe("price buckets", () => {
  it("unknown price never matches a price filter", () => {
    expect(priceMatches(null, "free")).toBe(false);
    expect(priceMatches(null, "any")).toBe(true);
  });
  it("buckets", () => {
    expect(priceMatches(0, "free")).toBe(true);
    expect(priceMatches(999, "lt10")).toBe(true);
    expect(priceMatches(1000, "10-20")).toBe(true);
    expect(priceMatches(2500, "20-30")).toBe(true);
    expect(priceMatches(3500, "30plus")).toBe(true);
    expect(priceMatches(2000, "20-30")).toBe(false);
  });
  it("maps categories to types", () => {
    expect(eventType("fm")).toBe("fiesta");
    expect(eventType("festival")).toBe("festival");
    expect(eventType("otro")).toBe("evento");
  });
});

describe("filterPlaces", () => {
  const club = place("club", { openingHours: { fri: [{ open: "23:59", close: "06:00" }] }, genres: ["techno"], events: [ev("techno-sat", "2026-09-26T21:00:00Z", { genres: ["techno"], priceMin: 1500 })] });
  const quiet = place("quiet", { openingHours: { tue: [{ open: "22:00", close: "02:00" }] } });
  const party = place("party", { kind: "event", venueType: null, events: [ev("party", "2026-09-25T20:00:00Z", { priceMin: 0 })] });
  const past = place("past", { kind: "event", venueType: null, events: [ev("past", "2026-09-24T20:00:00Z", { endsAt: new Date("2026-09-25T02:00:00Z") })] });
  const all = [club, quiet, party, past];

  it("never shows events that already ended", () => {
    expect(ids(filterPlaces(all, DEFAULT_FILTERS, { now: NOW }))).not.toContain("past");
  });

  it("today: venues open tonight + tonight's events, not the Tuesday bar", () => {
    const r = ids(filterPlaces(all, f({ when: "today" }), { now: NOW }));
    expect(r).toContain("club"); // opens Friday 23:59 (no event tonight)
    expect(r).toContain("party");
    expect(r).not.toContain("quiet");
  });

  it("tomorrow keeps the venue through its event", () => {
    const r = filterPlaces(all, f({ when: "tomorrow" }), { now: NOW });
    expect(ids(r)).toEqual(["club"]);
    expect(r[0]!.events.map((e) => e.id)).toEqual(["techno-sat"]);
  });

  it("price filter needs a known price", () => {
    expect(ids(filterPlaces(all, f({ price: "free" }), { now: NOW }))).toEqual(["party"]);
    expect(ids(filterPlaces(all, f({ price: "10-20" }), { now: NOW }))).toEqual(["club"]);
  });

  it("type and genre filters", () => {
    // The club shows up through its own "fiesta" event.
    expect(ids(filterPlaces(all, f({ types: ["fiesta"] }), { now: NOW }))).toEqual(["party", "club"]);
    expect(ids(filterPlaces(all, f({ types: ["concierto"] }), { now: NOW }))).toEqual([]);
    expect(ids(filterPlaces(all, f({ types: ["club"] }), { now: NOW })).sort()).toEqual(["club", "quiet"]);
    expect(ids(filterPlaces(all, f({ genres: ["techno"] }), { now: NOW }))).toEqual(["club"]);
  });

  it("text search over names, genres and event titles", () => {
    expect(ids(filterPlaces(all, f({ query: "TECHNO" }), { now: NOW }))).toEqual(["club"]);
  });

  it("open now uses the hours at the current time", () => {
    const late = new Date("2026-09-25T23:00:00Z"); // Sat 01:00: club open, party (22:00, no end) still running
    expect(ids(filterPlaces(all, f({ openNow: true }), { now: late })).sort()).toEqual(["club", "party"]);
    const noon = new Date("2026-09-26T10:00:00Z"); // Sat 12:00: nothing open
    expect(ids(filterPlaces(all, f({ openNow: true }), { now: noon }))).toEqual([]);
  });

  it("sorts by distance when location is known", () => {
    const near = place("near", { lat: 41.3871, lng: 2.1701 });
    const far = place("far", { lat: 41.45, lng: 2.25 });
    const r = filterPlaces([far, near], DEFAULT_FILTERS, { now: NOW, coords: { lat: 41.387, lng: 2.17 }, sortByDistance: true });
    expect(ids(r)).toEqual(["near", "far"]);
    expect(formatDistance(r[0]!.distanceKm!)).toBe("50 m");
  });
});

describe("distances", () => {
  it("formats metres and kilometres", () => {
    expect(formatDistance(0.45)).toBe("450 m");
    expect(formatDistance(1.2)).toBe("1,2 km");
    expect(formatDistance(3.5)).toBe("3,5 km");
  });
});

describe("directions", () => {
  const to = { lat: 41.39, lng: 2.17, name: "Sala" };
  it("uses the device's maps app", () => {
    expect(directionsUrl(to, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toMatch(/^https:\/\/maps\.apple\.com\/\?daddr=41\.39,2\.17/);
    expect(directionsUrl(to, "Mozilla/5.0 (Linux; Android 14)")).toMatch(/^geo:41\.39,2\.17/);
    expect(directionsUrl(to, "Mozilla/5.0 (Windows NT 10.0)")).toBe("https://www.google.com/maps/dir/?api=1&destination=41.39,2.17");
  });
});

describe("search intent", () => {
  const cities = [{ slug: "barcelona", name: "Barcelona" }];
  it("fiesta hoy", () => {
    expect(parseSearchIntent("fiesta hoy", cities)).toMatchObject({ when: "today", types: ["fiesta"], text: "" });
  });
  it("clubs cerca de mí", () => {
    expect(parseSearchIntent("clubs cerca de mí", cities)).toMatchObject({ near: true, types: ["club"], text: "" });
  });
  it("techno → genre", () => {
    expect(parseSearchIntent("techno", cities)).toMatchObject({ genres: ["techno"], text: "" });
  });
  it("Barcelona → city", () => {
    expect(parseSearchIntent("Barcelona", cities)).toMatchObject({ city: "barcelona", text: "" });
  });
  it("names stay as text", () => {
    expect(parseSearchIntent("Razzmatazz", cities)).toMatchObject({ text: "razzmatazz", when: null, types: [] });
    expect(parseSearchIntent("house gratis este finde en Barcelona", cities)).toMatchObject({ genres: ["house"], free: true, when: "weekend", city: "barcelona", text: "" });
  });
});

describe("prices and tickets on the map", () => {
  it("uses the cheapest published event price, else the venue's own, else nothing", async () => {
    const { lowestPrice } = await import("@/lib/map-filters");
    expect(lowestPrice({ priceMin: 2000 }, [{ priceMin: null }, { priceMin: 1500 }, { priceMin: 1200 }])).toBe(1200);
    expect(lowestPrice({ priceMin: 2000 }, [{ priceMin: null }])).toBe(2000);
    expect(lowestPrice({ priceMin: null }, [])).toBeNull();
  });

  it("links tickets first, then the official page, never a guessed URL", async () => {
    const { ticketLink } = await import("@/lib/map-filters");
    expect(ticketLink([{ ticketUrl: null, officialUrl: "https://a" }, { ticketUrl: "https://t", officialUrl: null }])).toEqual({ href: "https://t", buy: true });
    expect(ticketLink([{ ticketUrl: null, officialUrl: "https://a" }])).toEqual({ href: "https://a", buy: false });
    expect(ticketLink([{ ticketUrl: null, officialUrl: null }])).toBeNull();
  });
});

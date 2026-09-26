import { describe, expect, it } from "vitest";
import { buildSearchText, cleanText, normalizeSearch, slugify } from "@/lib/text";
import { formatPrice } from "@/lib/money";
import { boundingBox, distanceKm, formatDistance } from "@/lib/geo";
import { safeNext } from "@/lib/safe-next";
import { parseDiscover } from "@/lib/discover-params";
import mediaLoader from "@/lib/media-loader";

describe("text", () => {
  it("normalises accents for search", () => {
    expect(normalizeSearch("  Festa de GRÀCIA  ")).toBe("festa de gracia");
    expect(buildSearchText("Sala Nébula", null, "Poblenou")).toBe("sala nebula poblenou");
  });
  it("slugifies", () => expect(slugify("FM Gràcia — 2026!")).toBe("fm-gracia-2026"));
  it("strips control characters and collapses blank lines", () => {
    expect(cleanText("hola\u0000‮ mundo\n\n\n\nfin  ")).toBe("hola mundo\n\nfin");
  });
});

describe("money", () => {
  it("formats prices", () => {
    expect(formatPrice(0)).toBe("Gratis");
    expect(formatPrice(null)).toBe("Precio no disponible");
    expect(formatPrice(1500).replace(/\s/g, " ")).toBe("15 €");
    expect(formatPrice(1250).replace(/\s/g, " ")).toBe("12,50 €");
    expect(formatPrice(1000, 2000).replace(/\s/g, " ")).toBe("10 € – 20 €");
  });
});

describe("geo", () => {
  const plazaSol = { lat: 41.4026, lng: 2.1567 };
  const sagrada = { lat: 41.4036, lng: 2.1744 };
  it("computes distances", () => {
    expect(distanceKm(plazaSol, sagrada)).toBeCloseTo(1.48, 1);
    expect(formatDistance(0.33)).toBe("350 m");
    expect(formatDistance(1.48)).toBe("1,5 km");
  });
  it("bounding box contains points within radius", () => {
    const bb = boundingBox(plazaSol, 2);
    expect(sagrada.lat).toBeGreaterThan(bb.minLat);
    expect(sagrada.lng).toBeLessThan(bb.maxLng);
  });
});

describe("security helpers", () => {
  it("only allows relative redirects", () => {
    expect(safeNext("/events/x")).toBe("/events/x");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
  });
});

describe("discover params", () => {
  it("maps filters to queries", () => {
    const f = parseDiscover({ when: "weekend", price: "10", genre: "techno" });
    expect(f.maxPrice).toBe(1000);
    expect(f.genres).toEqual(["techno"]);
    expect(f.qs).toBe("when=weekend&maxPrice=1000&genre=techno");
  });
  it("waits for coordinates when 'near me' is on", () => {
    expect(parseDiscover({ near: "1" }).waitingForLocation).toBe(true);
    expect(parseDiscover({ near: "1", lat: "41.4", lng: "2.1" }).near).toEqual({ lat: 41.4, lng: 2.1, radiusKm: 5 });
  });
  it("ignores unknown date filters", () => expect(parseDiscover({ when: "yesterday" as never }).when).toBeUndefined());
});

describe("media loader", () => {
  it("picks the smallest variant that fits", () => {
    expect(mediaLoader({ src: "/media/img/ab/x_lg.webp", width: 384 })).toBe("/media/img/ab/x_sm.webp?w=480");
    expect(mediaLoader({ src: "/media/img/ab/x_sm.webp", width: 1080 })).toBe("/media/img/ab/x_lg.webp?w=1280");
    expect(mediaLoader({ src: "data:image/webp;base64,xx", width: 100 })).toBe("data:image/webp;base64,xx");
  });
});

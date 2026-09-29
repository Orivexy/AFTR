import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDiscoveryQuery, buildRefreshQuery, osmAddress, parseOverpass } from "@/server/places/providers/osm-parse";
import { backoffMinutes, mayOverwrite, runLooksComplete, venueTypeFor } from "@/server/places/rules";

const fixture = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/overpass-bcn.json"), "utf8"));

describe("OpenStreetMap parsing", () => {
  const places = parseOverpass(fixture);
  const byId = Object.fromEntries(places.map((p) => [p.providerId, p]));

  it("keeps named nightlife places, drops unnamed/private ones and duplicates", () => {
    expect(places.map((p) => p.providerId).sort()).toEqual(["node/1001", "node/5005", "node/6006", "way/2002"]);
  });

  it("builds the address only from address tags", () => {
    expect(byId["node/1001"]!.address).toBe("Carrer de Pamplona, 88, 08018 Barcelona");
    expect(byId["way/2002"]!.address).toBeNull();
    expect(byId["node/6006"]!.neighborhood).toBe("Gràcia");
  });

  it("uses way centres, first phone, normalised web and instagram", () => {
    const w = byId["way/2002"]!;
    expect([w.lat, w.lng]).toEqual([41.3851, 2.1734]);
    expect(w.phone).toBe("+34 930 000 000");
    expect(byId["node/1001"]!.website).toBe("https://salaprueba.example/");
    expect(byId["node/1001"]!.instagram).toBe("@salaprueba");
  });

  it("parses opening hours or leaves them unknown (never guessed)", () => {
    expect(byId["node/1001"]!.hours).toEqual({ fri: [{ open: "00:00", close: "06:00" }], sat: [{ open: "00:00", close: "06:00" }] });
    expect(byId["way/2002"]!.hours).toBeNull();
  });

  it("maps categories and flags disused places as closed", () => {
    expect(byId["node/1001"]!.categories).toEqual(["nightclub"]);
    expect(byId["node/6006"]!.categories).toEqual(["live_music_venue"]);
    expect(byId["node/5005"]!.businessStatus).toBe("CLOSED_PERMANENTLY");
    expect(byId["node/1001"]!.businessStatus).toBeNull();
  });

  it("never invents rating, photos or price", () => {
    expect(places.every((p) => p.rating === null && p.ratingCount === null)).toBe(true);
  });

  it("links to the OSM object as source", () => {
    expect(byId["way/2002"]!.sourceUrl).toBe("https://www.openstreetmap.org/way/2002");
  });

  it("address needs a street", () => {
    expect(osmAddress({ "addr:city": "Barcelona" })).toBeNull();
    expect(osmAddress({ "addr:full": "Plaça X 1, Barcelona" })).toBe("Plaça X 1, Barcelona");
  });
});

describe("Overpass queries", () => {
  it("searches every category around the city", () => {
    const q = buildDiscoveryQuery({ name: "Barcelona", lat: 41.3874, lng: 2.1686, radiusKm: 12 }, ["nightclub", "music_venue"]);
    expect(q).toContain('nwr["amenity"="nightclub"]["name"](around:12000,41.38740,2.16860);');
    expect(q).toContain('nwr["amenity"="music_venue"]');
    expect(q).toContain("out center tags;");
  });

  it("re-reads by id and ignores malformed ids", () => {
    expect(buildRefreshQuery(["node/1", "way/2", "node/3", "bad"])).toContain("node(id:1,3);");
    expect(buildRefreshQuery(["bad"])).toBeNull();
  });
});

describe("sync rules", () => {
  const venue = { id: "v1", primarySourceId: "s1", trust: "IMPORTED" as const };

  it("only the primary source or the venue's official source overwrites", () => {
    expect(mayOverwrite({ sourceId: "s1", sourceTrust: "IMPORTED", sourceVenueId: null, venue })).toBe(true);
    expect(mayOverwrite({ sourceId: "s2", sourceTrust: "IMPORTED", sourceVenueId: null, venue })).toBe(false);
    expect(mayOverwrite({ sourceId: "s2", sourceTrust: "OFFICIAL", sourceVenueId: "v1", venue })).toBe(true);
  });

  it("never overwrites community venues", () => {
    expect(mayOverwrite({ sourceId: "s1", sourceTrust: "IMPORTED", sourceVenueId: null, venue: { ...venue, trust: "COMMUNITY" } })).toBe(false);
  });

  it("does not close places after an empty or truncated run", () => {
    expect(runLooksComplete(0, 40)).toBe(false);
    expect(runLooksComplete(15, 40)).toBe(false);
    expect(runLooksComplete(38, 40)).toBe(true);
    expect(runLooksComplete(5, 0)).toBe(true);
  });

  it("retries quickly, doubling on each failure, capped", () => {
    expect(backoffMinutes(30, 0)).toBe(30);
    expect(backoffMinutes(30, 1)).toBe(30);
    expect(backoffMinutes(30, 2)).toBe(60);
    expect(backoffMinutes(30, 4)).toBe(240);
    expect(backoffMinutes(30, 20)).toBe(360);
    expect(backoffMinutes(24 * 60, 1)).toBe(30);
    expect(backoffMinutes(24 * 60, 3)).toBe(120);
    expect(backoffMinutes(24 * 60, 30)).toBe(24 * 60);
    expect(backoffMinutes(5, 1)).toBe(15);
  });

  it("derives the venue type from categories", () => {
    expect(venueTypeFor(["nightclub"])).toBe("CLUB");
    expect(venueTypeFor(["live_music_venue"])).toBe("CONCERT_HALL");
    expect(venueTypeFor(["event_venue"])).toBe("OTHER");
  });
});

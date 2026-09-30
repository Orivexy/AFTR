import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DATABASE_URL ??= "postgresql://test@localhost:5432/test"; // env is validated on import; nothing connects
const { matchVenue } = await import("@/server/discovery/store");
import { BARCELONA_VENUES, EXCLUDED } from "@/server/discovery/curated/barcelona";
import { instagramHandle, officialSiteInfo, pagePhotos, structuredHours } from "@/server/discovery/parsers/official-site";
import { detectCategory } from "@/server/discovery/normalize";
import { DEFAULT_FILTERS, filterPlaces, placeType } from "@/lib/map-filters";
import { eventFilterFor, nightlifeFilter, VENUE_TYPE_LABEL } from "@/lib/nightlife";
import type { MapPlace } from "@/lib/types";

describe("Listado verificado de Barcelona", () => {
  it("has unique keys, a known kind and verification sources for every place", () => {
    const keys = BARCELONA_VENUES.map((v) => v.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const v of BARCELONA_VENUES) {
      expect(v.key).toMatch(/^[a-z0-9-]+$/);
      expect(VENUE_TYPE_LABEL[v.type]).toBeTruthy();
      expect(v.sources.length).toBeGreaterThan(0);
      for (const s of v.sources) expect(s).toMatch(/^https:\/\//);
      if (v.website) expect(v.website).toMatch(/^https?:\/\//);
      expect(v.address).toMatch(/\d/); // street number (or s/n) as published
      expect(v.description.length).toBeLessThan(200);
      expect(v.verifiedAt).toMatch(/^2026-/);
    }
  });

  it("lists only open places and none of the excluded ones", () => {
    expect(BARCELONA_VENUES.every((v) => v.status === "OPEN")).toBe(true);
    const names = BARCELONA_VENUES.map((v) => v.name.toLowerCase());
    for (const x of EXCLUDED) expect(names).not.toContain(x.name.toLowerCase());
  });

  it("includes the requested clubs and event spaces (renamed ones under their current name)", () => {
    const names = new Set(BARCELONA_VENUES.flatMap((v) => [v.name, ...(v.aliases ?? [])]));
    for (const n of ["Razzmatazz", "Opium Barcelona", "Shôko Barcelona", "Sutton Barcelona", "Moog", "Sala Apolo", "City Hall Barcelona", "Otto Zutz", "Macarena Club", "Hyde Club", "Bling Bling Barcelona", "Pacha Barcelona", "CDLC Barcelona", "Sala Plataforma", "M7 Club", "Draco Disco Club", "La Biblio", "INPUT", "LAUT", "Nitsa Club", "Jamboree", "Sidecar Factory Club", "Arena Classic", "Sala Upload", "Wolf Barcelona", "Palau Sant Jordi", "Parc del Fòrum", "Poble Espanyol", "Fira Gran Via", "Sant Jordi Club", "Paral·lel 62", "La 2 de Apolo"]) {
      expect(names.has(n), n).toBe(true);
    }
  });
});

describe("Web oficial de un local", () => {
  const html = `<html><head>
    <meta property="og:image" content="https://club.example/img/fachada.jpg">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"NightClub","name":"Club","image":["https://cdn.example/sala1.webp",{"url":"https://cdn.example/sala2.jpg"}],
      "priceRange":"15-30 €","sameAs":["https://www.instagram.com/clubofficial/"],
      "openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["https://schema.org/Friday","Saturday"],"opens":"23:59:00","closes":"06:00:00"}]}</script>
    </head><body>
      <img src="/img/logo.png" alt="logo"><img src="/img/pista.jpg" width="1200"><img src="/img/mini.jpg" width="40">
      <a href="https://instagram.com/p/abc123/">post</a><a href="https://www.instagram.com/clubofficial/">IG</a>
    </body></html>`;

  it("reads photos, Instagram, hours and price range from the page's own data", () => {
    const info = officialSiteInfo(html, "https://club.example/");
    expect(info.images).toEqual(["https://club.example/img/fachada.jpg", "https://cdn.example/sala1.webp", "https://cdn.example/sala2.jpg", "https://club.example/img/pista.jpg"]);
    expect(info.instagram).toBe("clubofficial");
    expect(info.hours).toEqual({ fri: [{ open: "23:59", close: "06:00" }], sat: [{ open: "23:59", close: "06:00" }] });
    expect(info.priceMin).toBe(1500);
    expect(info.priceMax).toBe(3000);
  });

  it("leaves unknown values empty (never guessed)", () => {
    const info = officialSiteInfo("<html><body><p>Hola</p></body></html>", "https://x.example/");
    expect(info).toEqual({ images: [], instagram: null, hours: null, priceMin: null, priceMax: null });
    expect(structuredHours([{ "@type": "NightClub", priceRange: "€€" }])).toBeNull();
  });

  it("skips logos, icons and tiny images", () => {
    expect(pagePhotos('<img src="/a/logo-white.png"><img src="/icons/fb.jpg"><img src="/x.svg"><img src="/p.jpg" width="120">', "https://s.example/")).toEqual([]);
  });

  it("ignores post links when finding the account", () => {
    expect(instagramHandle('<a href="https://www.instagram.com/p/xyz/">')).toBeNull();
    expect(instagramHandle('<a href="https://instagram.com/reel/xyz/"></a><a href="https://instagram.com/sala.apolo">')).toBe("sala.apolo");
  });
});

describe("Eventos de los locales verificados", () => {
  const ku = { id: "ku", name: "Ku Barcelona", address: "Passeig Marítim, 38", lat: 41.3857, lng: 2.1967, type: "DISCO", aliases: ["Pacha Barcelona", "Pacha"] };
  const apolo = { id: "apolo", name: "Sala Apolo", address: "Nou de la Rambla, 113", lat: 41.3744, lng: 2.1696, type: "CONCERT_HALL", aliases: ["Apolo"] };

  it("matches events by the place's old name or room", () => {
    expect(matchVenue([ku, apolo], "Pacha Barcelona", null, null)?.id).toBe("ku");
    expect(matchVenue([ku, apolo], "Pacha", 41.386, 2.197)?.id).toBe("ku");
    // Ticketing coordinates a few hundred metres off: same name still matches.
    expect(matchVenue([ku, apolo], "Sala Apolo", 41.377, 2.172)?.id).toBe("apolo");
  });

  it("does not match other places", () => {
    expect(matchVenue([ku, apolo], "Sala Upload", 41.369, 2.149)).toBeNull();
    expect(matchVenue([ku, apolo], "Club", 41.3744, 2.1696)).toBeNull();
  });

  it("classifies tribute and special nights", () => {
    expect(detectCategory("Tributo a ABBA", null, true)).toBe("tematica");
    expect(detectCategory("Halloween Party", null, true)).toBe("tematica");
    expect(detectCategory("Nochevieja 2026", null, true)).toBe("especial");
    expect(detectCategory("Primavera Sound", "Festival", false)).toBe("festival");
  });
});

describe("Filtros de ocio nocturno", () => {
  it("maps each filter to kinds of place and of event", () => {
    expect(nightlifeFilter("nada").value).toBe("todos");
    expect(eventFilterFor("discotecas")).toEqual({ venueTypes: ["DISCO"] });
    expect(eventFilterFor("conciertos")).toEqual({ categories: ["concierto"] });
    expect(eventFilterFor("todos")).toEqual({});
  });

  const place = (id: string, venueType: string): MapPlace => ({
    kind: "venue", id, slug: id, name: id, lat: 41.38, lng: 2.17, coverKey: null, address: "", neighborhood: null, venueType, genres: [],
    ratingAvg: null, ratingCount: null, priceMin: null, priceMax: null, currency: "EUR", timezone: "Europe/Madrid", openingHours: null, events: [], attribution: null,
  } as unknown as MapPlace);

  it("shows places on the map under their kind", () => {
    const places = [place("disco", "DISCO"), place("club", "CLUB"), place("sala", "CONCERT_HALL"), place("forum", "FESTIVAL_SPACE"), place("palau", "EVENT_SPACE")];
    const ids = (types: string[]) => filterPlaces(places, { ...DEFAULT_FILTERS, types: types as never }).map((r) => r.place.id);
    expect(ids([])).toHaveLength(5);
    expect(ids(["discoteca"])).toEqual(["disco"]);
    expect(ids(["club"])).toEqual(["club"]);
    expect(ids(["festival"])).toEqual(["forum"]);
    expect(placeType("EVENT_SPACE")).toBe("evento");
  });
});

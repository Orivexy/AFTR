import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DATABASE_URL ??= "postgresql://test@localhost:5432/test"; // env is validated on import; nothing connects
const { isNightlifeEvent } = await import("@/server/discovery/store");
import { parseCataloniaAgenda, parseStartTime } from "@/server/discovery/parsers/catalonia-agenda";
import { parseBcnMusicVenues, parseBcnTimetable, parseCatalanDays } from "@/server/discovery/parsers/bcn-music-venues";

const TZ = "Europe/Madrid";
const item = (over: Record<string, unknown>) => ({
  codi: "2026072200006",
  denominaci: "Concert de The Tutsies",
  data_inici: "2026-10-03T00:00:00.000",
  data_fi: "2026-10-03T00:00:00.000",
  horari: "20.30 h",
  entrades: "Preu: 20 €",
  gratuita: "No",
  linkbotoentrades: "https://entradium.com/events/x",
  url: "https://www.sala-apolo.com/cat/",
  tags_categor_es: "agenda:categories/concerts",
  tags_mbits: "agenda:ambits/musica",
  espai: "Sala Apolo",
  adre_a: "C. Nou de la Rambla, 113, Barcelona",
  latitud: "41.3744026",
  longitud: "2.1695739",
  imatges: "/content/dam/agenda/ca/activitats/2026/07/22/000/06/annexos/THE TUTSIES.jpg",
  ...over,
});

describe("Agenda cultural de Catalunya (Barcelona)", () => {
  it("keeps concerts and parties with time, place, price and ticket link", () => {
    const { events, skipped } = parseCataloniaAgenda(
      [
        item({}),
        item({ codi: "2", denominaci: "Festa Major de Gràcia", tags_categor_es: "agenda:categories/festes", gratuita: "Sí", entrades: "", horari: "De 18 a 23 h" }),
        item({ codi: "3", tags_categor_es: "agenda:categories/exposicions", denominaci: "Exposició" }),
        item({ codi: "4", tags_categor_es: "agenda:categories/concerts,agenda:categories/infantil" }),
        item({ codi: "5", data_fi: "2027-01-31T00:00:00.000" }),
        item({ codi: "6", denominaci: "ACTIVITAT CANCEL·LADA Concert solidari" }),
        item({ codi: "7", denominaci: "Arielle Beck", subt_tol: "Recital de piano", espai: "Palau de la Música Catalana" }),
        item({ codi: "8", denominaci: "La Traviata", tags_categor_es: "agenda:categories/opera" }),
      ],
      TZ,
    );
    expect(skipped).toBe(5);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      externalId: "2026072200006",
      start: { kind: "local", date: "2026-10-03", time: "20:30" },
      priceMin: 2000,
      isFree: false,
      ticketUrl: "https://entradium.com/events/x",
      place: { name: "Sala Apolo", lat: 41.3744026, lng: 2.1695739 },
      categoryHint: "concierto",
      imageUrls: ["https://agenda.cultura.gencat.cat/content/dam/agenda/ca/activitats/2026/07/22/000/06/annexos/THE%20TUTSIES.jpg"],
    });
    expect(events[1]).toMatchObject({ isFree: true, priceMin: 0, start: { time: "18:00" }, categoryHint: "festa major" });
    expect(events[2]).toMatchObject({ title: "Concert solidari", cancelled: true });
  });

  it("reads start times without guessing", () => {
    expect(parseStartTime("A les 21 h")).toBe("21:00");
    expect(parseStartTime("22:30")).toBe("22:30");
    expect(parseStartTime("De 10.30 a 14 h")).toBe("10:30");
    expect(parseStartTime("Consulteu el web")).toBeNull();
  });
});

describe("Barcelona · espais de música i copes", () => {
  const timetable =
    '<table class="timetable-table"><tr class="timetable-header"><th class="weekdays">Dies</th><th class="hours">Hores</th></tr><tr><td class="timetable-day" rowspan=1><div>Dijous</div></td><td class="timetable-hour" rowspan=1><div>de 00.00&nbsp;h a 05.00&nbsp;h</div></td></tr><tr><td class="timetable-day" rowspan=1><div>Divendres i dissabte</div></td><td class="timetable-hour" rowspan=1><div>de 00.00&nbsp;h a 06.00&nbsp;h</div></td></tr></table>';

  it("parses Catalan days and the official timetable", () => {
    expect(parseCatalanDays("De dijous a dissabte")).toEqual(["thu", "fri", "sat"]);
    expect(parseCatalanDays("Divendres i dissabte")).toEqual(["fri", "sat"]);
    expect(parseCatalanDays("Tots els dies")).toHaveLength(7);
    expect(parseBcnTimetable(timetable)).toEqual({
      thu: [{ open: "00:00", close: "05:00" }],
      fri: [{ open: "00:00", close: "06:00" }],
      sat: [{ open: "00:00", close: "06:00" }],
    });
    expect(parseBcnTimetable("<p>Consulteu</p>")).toBeNull();
  });

  it("groups rows by place and keeps the most specific type", () => {
    const base = { register_id: "﻿99400328185", name: "Discoteca La Biblio", addresses_road_name: "C Moià", addresses_start_street_number: "1", geo_epgs_4326_lat: "41.3955", geo_epgs_4326_lon: "2.1522", timetable };
    const { venues, skipped } = parseBcnMusicVenues([
      { ...base, secondary_filters_name: "Discoteques", values_category: "Telèfons", values_attribute_name: "Tel.", values_value: "658 253 842" },
      { ...base, secondary_filters_name: "Bars i pubs musicals", values_category: "Telèfons", values_attribute_name: "Tel.", values_value: "658 253 842" },
      { register_id: "2", name: "Restaurant", secondary_filters_name: "Restaurants", geo_epgs_4326_lat: "41.39", geo_epgs_4326_lon: "2.15" },
      { register_id: "3", name: "Pub musical", secondary_filters_name: "Bars i pubs musicals", geo_epgs_4326_lat: "41.39", geo_epgs_4326_lon: "2.15" },
    ]);
    expect(skipped).toBe(2);
    expect(venues).toEqual([
      expect.objectContaining({
        externalId: "bcn-99400328185",
        name: "Discoteca La Biblio",
        address: "Carrer Moià 1",
        phone: "658 253 842",
        types: ["nightclub"],
        lat: 41.3955,
        openingHours: expect.objectContaining({ fri: [{ open: "00:00", close: "06:00" }] }),
      }),
    ]);
  });
});

describe("club-only filter", () => {
  it("keeps only events at discotecas", () => {
    const venues = [{ id: "club", name: "Opium", address: "", lat: 0, lng: 0, type: "CLUB" }, { id: "bar", name: "Bar", address: "", lat: 0, lng: 0, type: "BAR" }];
    expect(isNightlifeEvent({ category: "concierto", venueId: "club" }, venues)).toBe(true);
    expect(isNightlifeEvent({ category: "concierto", venueId: null, venueName: "Sala Apolo" }, venues)).toBe(true);
    expect(isNightlifeEvent({ category: "dj", venueId: null, venueName: "Razzmatazz" }, venues)).toBe(true);
    expect(isNightlifeEvent({ category: "fm", venueId: null, venueName: "Plaça del Sol" }, venues)).toBe(false);
    expect(isNightlifeEvent({ category: "concierto", venueId: "bar" }, venues)).toBe(false);
    expect(isNightlifeEvent({ category: "concierto", venueId: null, venueName: "Palau de la Música Catalana" }, venues)).toBe(false);
    expect(isNightlifeEvent({ category: "festival", venueId: null, venueName: "Parc del Fòrum" }, venues)).toBe(false);
  });
});

describe("Xceed agenda (schema.org pages)", async () => {
  const { matchingLinks } = await import("@/server/discovery/connectors/jsonld");
  const { jsonLdToEvents } = await import("@/server/discovery/parsers/jsonld");
  const pattern = new RegExp("^https://xceed\\.me/es/barcelona/event/[^/]+/\\d+$");

  it("follows only event links of the same site, once", () => {
    const html = `<a href="/es/barcelona/event/humanos-x-nom/243900">a</a><a href="/es/barcelona/event/humanos-x-nom/243900?utm=x">dup</a>
      <a href="/es/barcelona/club/opium">club</a><a href="https://other.example/es/barcelona/event/x/1">other</a><a href="/es/barcelona/event/voral/244904">b</a>`;
    expect(matchingLinks(html, "https://xceed.me/es/barcelona/events", pattern, 10)).toEqual([
      "https://xceed.me/es/barcelona/event/humanos-x-nom/243900",
      "https://xceed.me/es/barcelona/event/voral/244904",
    ]);
  });

  it("keeps only events at a NightClub and marks them as club nights", () => {
    const nodes = [
      { "@type": "Event", "@id": "https://xceed.me/event/1#event", name: "HUMANOS x NOM", startDate: "2026-10-18T23:30:00+02:00", location: { "@type": "NightClub", name: "SEASEACLUB" }, image: "https://images.xceed.me/a.jpg" },
      { "@type": "Event", "@id": "https://xceed.me/event/2#event", name: "Open air", startDate: "2026-10-19T16:00:00+02:00", location: { "@type": "Place", name: "Parc" } },
    ];
    const events = jsonLdToEvents(nodes, "https://xceed.me/es/barcelona/events", "Europe/Madrid", { nightClubsOnly: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: "HUMANOS x NOM", categoryHint: "discoteca", place: { name: "SEASEACLUB" }, imageUrls: ["https://images.xceed.me/a.jpg"] });
  });
});

describe("event photos", async () => {
  const { ogImage, jsonLdToEvents } = await import("@/server/discovery/parsers/jsonld");
  it("uses the page's share image when the event has none", () => {
    const html = '<meta property="og:image" content="https://images.xceed.me/events/x.jpg?w=1200&amp;h=630">';
    expect(ogImage(html)).toBe("https://images.xceed.me/events/x.jpg?w=1200&h=630");
    const [e] = jsonLdToEvents([{ "@type": "Event", name: "Noche", startDate: "2026-10-18T23:30:00+02:00", location: { "@type": "NightClub", name: "Club", image: "https://img/club.jpg" } }], "https://x/e/1", "Europe/Madrid", { fallbackImage: ogImage(html) });
    expect(e!.imageUrls).toEqual(["https://images.xceed.me/events/x.jpg?w=1200&h=630"]);
    expect(e!.place?.imageUrl).toBe("https://img/club.jpg");
  });
});

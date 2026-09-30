import { describe, expect, it } from "vitest";
import { parseMadridAgenda, parsePriceText } from "@/server/discovery/parsers/madrid-agenda";

const item = (over: Record<string, unknown>) => ({
  "@type": "https://datos.madrid.es/egob/kos/actividades/Musica",
  id: "1",
  title: "Concierto de jazz",
  free: 0,
  price: "",
  dtstart: "2026-10-03 00:00:00.0",
  dtend: "2026-10-03 23:59:00.0",
  time: "20:30",
  "event-location": "Centro Cultural Conde Duque",
  address: { area: { "street-address": "CALLE CONDE DUQUE 9", locality: "MADRID" } },
  location: { latitude: 40.4274, longitude: -3.7106 },
  link: "http://www.madrid.es/x",
  ...over,
});

describe("Madrid open-data agenda", () => {
  it("keeps music, fiestas and dance with real dates, place and price", () => {
    const { events, skipped } = parseMadridAgenda(
      {
        "@graph": [
          item({ price: "Entrada: 8 €" }),
          item({ id: "2", "@type": "https://datos.madrid.es/egob/kos/actividades/Fiestas", title: "Fiestas del Pilar", free: 1, time: "" }),
          item({ id: "3", "@type": "https://datos.madrid.es/egob/kos/actividades/Exposiciones" }),
          item({ id: "4", audience: "Niños,Familias" }),
          item({ id: "5", dtend: "2027-01-31 23:59:00.0" }),
        ],
      },
      "Europe/Madrid",
    );
    expect(skipped).toBe(3);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      externalId: "1",
      start: { kind: "local", date: "2026-10-03", time: "20:30" },
      end: null,
      priceMin: 800,
      priceMax: 800,
      isFree: false,
      place: { name: "Centro Cultural Conde Duque", address: "Calle Conde Duque 9", lat: 40.4274, lng: -3.7106 },
      categoryHint: "concierto",
    });
    expect(events[1]).toMatchObject({ isFree: true, priceMin: 0, start: { time: null }, categoryHint: "fiesta mayor" });
  });

  it("parses price texts without inventing", () => {
    expect(parsePriceText("De 12 a 18 €")).toEqual({ min: 1200, max: 1800 });
    expect(parsePriceText("5,50 euros")).toEqual({ min: 550, max: 550 });
    expect(parsePriceText("Consultar")).toEqual({ min: null, max: null });
  });

  it("rejects an unexpected format", () => {
    expect(() => parseMadridAgenda({ foo: 1 }, "Europe/Madrid")).toThrow();
  });
});

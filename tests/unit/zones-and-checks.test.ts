import { describe, expect, it } from "vitest";
import { pickZone, zonePrompts, ZONES } from "@/lib/zones";
import { handleMatchesVenue, pickLocation } from "@/server/discovery/curated/checks";

const BCN = { lat: 41.3874, lng: 2.1686 };

describe("Zonas del local (red neuronal)", () => {
  const scores = (by: Record<string, number>) => {
    const rest = zonePrompts().filter((p) => !(p.prompt in by));
    const left = Math.max(0, 1 - Object.values(by).reduce((a, b) => a + b, 0));
    return [...Object.entries(by).map(([label, score]) => ({ label, score })), ...rest.map((p) => ({ label: p.prompt, score: left / rest.length }))];
  };

  it("adds the scores of each zone's descriptions and keeps confident answers", () => {
    const [a, b] = ZONES.find((z) => z.slug === "dj")!.prompts;
    expect(pickZone(scores({ [a!]: 0.3, [b!]: 0.25 }))?.zone).toBe("dj");
  });

  it("leaves flyers, logos and unclear photos without zone", () => {
    expect(pickZone(scores({ "a poster or flyer with text": 0.7 }))).toBeNull();
    expect(pickZone(scores({}))).toBeNull();
  });
});

describe("Comprobaciones del listado verificado", () => {
  it("rejects a geocoding result in another town (same street name)", () => {
    const sabadell = { lat: "41.548", lon: "2.107", address: { road: "Carrer de Mèxic", quarter: "Can Feu", city: "Sabadell" } };
    const bcn = { lat: "41.3745", lon: "2.1466", address: { road: "Carrer de Mèxic", quarter: "la Font de la Guatlla", suburb: "Sants-Montjuïc", city: "Barcelona" } };
    expect(pickLocation([sabadell], "Barcelona", BCN)).toBeNull();
    expect(pickLocation([sabadell, bcn], "Barcelona", BCN)).toEqual({ lat: 41.3745, lng: 2.1466, neighborhood: "la Font de la Guatlla", district: "Sants-Montjuïc" });
  });

  it("uses the municipality as zone outside Barcelona", () => {
    const fira = { lat: "41.354", lon: "2.127", address: { suburb: "Santa Eulàlia", city: "L'Hospitalet de Llobregat" } };
    expect(pickLocation([fira], "L'Hospitalet de Llobregat", BCN)?.district).toBe("L'Hospitalet de Llobregat");
  });

  it("accepts only the venue's own Instagram account", () => {
    expect(handleMatchesVenue("airechicas", ["Arena Xperience", "Arena Madre"])).toBe(false);
    expect(handleMatchesVenue("sala_apolo", ["Nitsa Club", "Nitsa"])).toBe(false);
    expect(handleMatchesVenue("moog_barcelona", ["Moog"])).toBe(true);
    expect(handleMatchesVenue("parallel62bcn", ["Paral·lel 62", "Parallel 62"])).toBe(true);
    expect(handleMatchesVenue("palausantjordi", ["Sant Jordi Club"])).toBe(true);
  });
});

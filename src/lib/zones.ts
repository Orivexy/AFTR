/**
 * Parts of a place that the image model looks for in its official photos.
 * The model (CLIP, zero-shot: scripts/classify-zones.mts) compares each photo
 * with these descriptions; `other` descriptions catch flyers, logos and
 * close-ups so they are not forced into a zone. A photo gets a zone only when
 * the model is confident enough (ZONE_MIN_SCORE); otherwise it stays unknown.
 */
export interface ZoneDef {
  slug: string;
  label: string;
  /** English descriptions (the model was trained on English captions). */
  prompts: string[];
}

export const ZONES: ZoneDef[] = [
  { slug: "pista", label: "Pista de baile", prompts: ["a crowded dance floor in a nightclub with lights", "people dancing in a club at night"] },
  { slug: "dj", label: "Cabina del DJ", prompts: ["a DJ booth with turntables and a mixer", "a DJ playing music behind the decks in a club"] },
  { slug: "vip", label: "Zona VIP / reservados", prompts: ["a VIP area with private tables, sofas and champagne bottles in a nightclub", "an elegant lounge with booths and bottle service"] },
  { slug: "barra", label: "Barra", prompts: ["a bar counter with bottles and bartenders", "cocktail bar counter in a club"] },
  { slug: "escenario", label: "Escenario", prompts: ["a concert stage with a band performing live", "a stage with stage lights and a crowd at a concert"] },
  { slug: "terraza", label: "Terraza", prompts: ["an outdoor terrace of a beach club", "an open-air terrace with tables at night"] },
  { slug: "entrada", label: "Entrada / fachada", prompts: ["the entrance and facade of a building from the street", "the front door and sign of a venue"] },
];

export const OTHER_PROMPTS = ["a poster or flyer with text", "a logo on a plain background", "a close-up portrait of a person", "a close-up of a drink or food"];

export const ZONE_MIN_SCORE = 0.35;

export const ZONE_LABEL: Record<string, string> = Object.fromEntries(ZONES.map((z) => [z.slug, z.label]));

/** Every description the model scores, with its zone ("" = not a zone). */
export function zonePrompts(): Array<{ prompt: string; zone: string }> {
  return [...ZONES.flatMap((z) => z.prompts.map((prompt) => ({ prompt, zone: z.slug }))), ...OTHER_PROMPTS.map((prompt) => ({ prompt, zone: "" }))];
}

/**
 * Zone of a photo from the model's scores (softmax over every description):
 * scores of the same zone add up; the best zone wins if it is a real zone
 * and clears the threshold.
 */
export function pickZone(scores: Array<{ label: string; score: number }>, minScore = ZONE_MIN_SCORE): { zone: string; score: number } | null {
  const zoneOf = new Map(zonePrompts().map((p) => [p.prompt, p.zone]));
  const total = new Map<string, number>();
  for (const s of scores) {
    const z = zoneOf.get(s.label);
    if (z === undefined) continue;
    total.set(z, (total.get(z) ?? 0) + s.score);
  }
  let best: { zone: string; score: number } | null = null;
  for (const [zone, score] of total) if (!best || score > best.score) best = { zone, score };
  if (!best || !best.zone || best.score < minScore) return null;
  return { zone: best.zone, score: Math.round(best.score * 1000) / 1000 };
}

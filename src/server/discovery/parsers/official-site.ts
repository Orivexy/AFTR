import type { OpeningHours } from "@/lib/types";
import { extractJsonLdBlocks, flattenNodes, ogImage } from "./jsonld";

/**
 * What a venue's own website says about itself: its photos, its Instagram
 * account, its hours and price range (only from structured data). Nothing is
 * inferred: a value that the page does not state stays null.
 */
export interface OfficialSiteInfo {
  images: string[];
  instagram: string | null;
  hours: OpeningHours | null;
  priceMin: number | null; // cents
  priceMax: number | null;
}

type Json = Record<string, unknown>;

const PLACE_TYPES = /^(NightClub|BarOrPub|MusicVenue|EventVenue|LocalBusiness|Place|EntertainmentBusiness|CivicStructure|StadiumOrArena|PerformingArtsTheater|Restaurant|Organization)$/;
const NOT_A_PHOTO = /(logo|icon|favicon|sprite|avatar|flag|payment|visa|mastercard|paypal|badge|button|arrow|placeholder|loader|spinner|pixel|tracking|qr|whatsapp|facebook|instagram|twitter|tiktok|spotify|youtube|apple-touch|app-store|google-play|cookie)/i;
const PHOTO_EXT = /\.(jpe?g|png|webp|avif)(\?|$)/i;
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about", "developer", "legal", "web"]);

const typesOf = (o: Json) => (Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]]).filter((t): t is string => typeof t === "string");
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function abs(u: string, base: string): string | null {
  try {
    const url = new URL(u.replace(/&amp;/g, "&").trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function imagesOf(v: unknown): string[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list
    .map((i) => (typeof i === "string" ? i : i && typeof i === "object" ? (str((i as Json).url) ?? str((i as Json).contentUrl)) : null))
    .filter((u): u is string => Boolean(u));
}

/** Photos of the page: share image, images in the place's structured data, then large photos in the page body. */
export function pagePhotos(html: string, pageUrl: string, max = 10): string[] {
  const out: string[] = [];
  const add = (u: string | null | undefined) => {
    if (!u) return;
    const a = abs(u, pageUrl);
    if (!a || NOT_A_PHOTO.test(a) || out.includes(a)) return;
    out.push(a);
  };
  add(ogImage(html));
  add(html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)?.[1]);
  for (const node of flattenNodes(extractJsonLdBlocks(html)) as Json[]) {
    if (!typesOf(node).some((t) => PLACE_TYPES.test(t))) continue;
    for (const u of [...imagesOf(node.image), ...imagesOf(node.photo)]) add(u);
  }
  for (const m of html.matchAll(/<img\b[^>]*?\s(?:data-src|data-lazy-src|src)=["']([^"']+)["'][^>]*>/gi)) {
    if (out.length >= max) break;
    const src = m[1]!;
    if (src.startsWith("data:") || !PHOTO_EXT.test(src)) continue;
    // Declared tiny images are icons, not photos.
    const w = Number(m[0].match(/\swidth=["']?(\d+)/i)?.[1] ?? 0);
    if (w && w < 300) continue;
    add(src);
  }
  return out.slice(0, max);
}

/** The venue's Instagram handle, from its structured data or links (most linked account wins). */
export function instagramHandle(html: string): string | null {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?=["'?#\s<])/g)) {
    const h = m[1]!.toLowerCase();
    if (IG_RESERVED.has(h)) continue;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [h, n] of counts) if (!best || n > counts.get(best)!) best = h;
  return best;
}

const DAY: Record<string, string> = { monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun", mo: "mon", tu: "tue", we: "wed", th: "thu", fr: "fri", sa: "sat", su: "sun" };
const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const hhmm = (v: unknown) => {
  const m = String(v ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : null;
};

/** Weekly hours from schema.org openingHoursSpecification or "Th-Sa 23:59-06:00" strings. */
export function structuredHours(nodes: Json[]): OpeningHours | null {
  const out: OpeningHours = {};
  const push = (day: string, open: string, close: string) => (out[day] ??= []).push({ open, close });
  for (const node of nodes) {
    if (!typesOf(node).some((t) => PLACE_TYPES.test(t))) continue;
    const specs = (Array.isArray(node.openingHoursSpecification) ? node.openingHoursSpecification : node.openingHoursSpecification ? [node.openingHoursSpecification] : []) as Json[];
    for (const s of specs) {
      const open = hhmm(s.opens);
      const close = hhmm(s.closes);
      if (!open || !close) continue;
      for (const d of Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]) {
        const key = DAY[String(d ?? "").split("/").pop()!.toLowerCase()];
        if (key) push(key, open, close);
      }
    }
    for (const line of Array.isArray(node.openingHours) ? node.openingHours : node.openingHours ? [node.openingHours] : []) {
      const m = String(line).match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
      if (!m) continue;
      const from = ORDER.indexOf(DAY[m[1]!.toLowerCase()] ?? "");
      const to = m[2] ? ORDER.indexOf(DAY[m[2].toLowerCase()] ?? "") : from;
      if (from < 0 || to < 0) continue;
      for (let i = from; ; i = (i + 1) % 7) {
        push(ORDER[i]!, hhmm(m[3])!, hhmm(m[4])!);
        if (i === to) break;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

/** "15-30 €" / "20€" from schema.org priceRange (symbols like "€€" say nothing and are ignored). */
export function structuredPrice(nodes: Json[]): { min: number; max: number | null } | null {
  for (const node of nodes) {
    if (!typesOf(node).some((t) => PLACE_TYPES.test(t))) continue;
    const nums = (str(node.priceRange) ?? "").match(/\d+(?:[.,]\d+)?/g)?.map((n) => Math.round(Number(n.replace(",", ".")) * 100));
    if (nums?.length) return { min: Math.min(...nums), max: nums.length > 1 ? Math.max(...nums) : null };
  }
  return null;
}

export function officialSiteInfo(html: string, pageUrl: string): OfficialSiteInfo {
  const nodes = flattenNodes(extractJsonLdBlocks(html)) as Json[];
  const price = structuredPrice(nodes);
  return {
    images: pagePhotos(html, pageUrl),
    instagram: instagramHandle(html),
    hours: structuredHours(nodes),
    priceMin: price?.min ?? null,
    priceMax: price?.max ?? null,
  };
}

import "server-only";
import { fetchText } from "../fetcher";
import { extractJsonLdBlocks, flattenNodes, jsonLdToEvents, jsonLdToVenues, ogImage } from "../parsers/jsonld";
import type { Connector, SourceContext } from "../types";

/**
 * Pages that publish schema.org structured data (the data sites publish for
 * search engines): official club/promoter pages or ticketing agendas.
 * robots.txt is honoured and requests are throttled per host.
 * config:
 *   pages?: string[]           extra pages (default: the source URL)
 *   followLinks?: { pattern, max }  also read the event pages linked from
 *                              those pages whose absolute URL matches `pattern`
 *   nightClubsOnly?: boolean   keep only events located at a NightClub
 *   pageVenues?: { [pageUrl]: venueName }  a venue's own agenda page (e.g. its
 *                              Xceed page): its events, and the event pages it
 *                              links to, are at that venue
 */
type Config = { pages?: unknown; followLinks?: { pattern?: unknown; max?: unknown }; nightClubsOnly?: unknown; pageVenues?: unknown };

function pages(ctx: SourceContext): string[] {
  const cfg = ctx.config as Config;
  const extra = Array.isArray(cfg.pages) ? cfg.pages.filter((p): p is string => typeof p === "string") : [];
  return [...new Set([ctx.url, ...extra].filter((p): p is string => Boolean(p)))].slice(0, 10);
}

/** Absolute links of a page matching the pattern (same site only), in page order. */
export function matchingLinks(html: string, pageUrl: string, pattern: RegExp, max: number): string[] {
  const base = new URL(pageUrl);
  const out: string[] = [];
  // Links in hrefs and in the page's embedded data (apps that render their
  // lists with scripts keep the URLs, often with escaped slashes, in JSON).
  const text = html.replace(/\\u002[fF]/g, "/").replace(/\\\//g, "/");
  const found = [...text.matchAll(/href=["']([^"'#]+)["']/gi), ...text.matchAll(/["'(](https?:\/\/[^"'\s<>#)]+|\/[a-z]{2}\/[^"'\s<>#)]+)/gi)];
  for (const m of found) {
    let u: URL;
    try {
      u = new URL(m[1]!, base);
    } catch {
      continue;
    }
    if (u.host !== base.host) continue;
    const href = `${u.origin}${u.pathname}`;
    if (pattern.test(href) && !out.includes(href)) out.push(href);
    if (out.length >= max) break;
  }
  return out;
}

async function nodes(ctx: SourceContext) {
  const cfg = ctx.config as Config;
  const follow = cfg.followLinks && typeof cfg.followLinks.pattern === "string" ? new RegExp(cfg.followLinks.pattern) : null;
  const maxFollow = Math.min(Number(cfg.followLinks?.max) || 40, 120);
  const venueOf = (cfg.pageVenues && typeof cfg.pageVenues === "object" ? cfg.pageVenues : {}) as Record<string, unknown>;
  const out: Array<{ page: string; nodes: ReturnType<typeof flattenNodes>; image: string | null; venue: string | null }> = [];
  const seen = new Set<string>();
  const read = async (page: string, venue: string | null) => {
    if (seen.has(page)) {
      // Already read from the general agenda: now we know whose event it is.
      const known = out.find((o) => o.page === page);
      if (known && venue && !known.venue) known.venue = venue;
      return "";
    }
    seen.add(page);
    const html = await fetchText(page, { accept: "text/html", respectRobots: true });
    out.push({ page, nodes: flattenNodes(extractJsonLdBlocks(html)), image: ogImage(html), venue });
    return html;
  };
  for (const page of pages(ctx)) {
    const venue = typeof venueOf[page] === "string" ? (venueOf[page] as string) : null;
    const html = await read(page, venue);
    if (!follow) continue;
    const links = matchingLinks(html, page, follow, maxFollow);
    ctx.log(`${page}: ${links.length} páginas de evento enlazadas`);
    for (const link of links) {
      try {
        await read(link, venue);
      } catch (err) {
        ctx.log(`${link}: ${(err as Error).message}`);
      }
    }
  }
  if (!out.length) throw new Error("La fuente necesita al menos una URL");
  return out;
}

export const jsonLdConnector: Connector = {
  label: "Web con datos estructurados (schema.org)",
  async fetchEvents(ctx) {
    const nightClubsOnly = (ctx.config as Config).nightClubsOnly === true;
    const pagesRead = await nodes(ctx);
    // An event page's share image stands in for a missing event image (not on list pages: it would be generic).
    const all = pagesRead.flatMap(({ page, nodes, image, venue }) =>
      jsonLdToEvents(nodes, page, ctx.city.timezone, { nightClubsOnly, fallbackImage: pagesRead.length > 1 && page !== pagesRead[0]!.page ? image : null }).map((e) =>
        // Read from a venue's own agenda page: an event without a place is at
        // that venue. One with its own place keeps it (venue pages also link
        // other venues' featured events).
        venue && !e.place?.name ? { ...e, place: { ...e.place, name: venue } } : e,
      ),
    );
    for (const { venue, page } of pagesRead) if (venue && page !== pagesRead[0]!.page) for (const e of all.filter((x) => x.sourceUrl === page)) ctx.log(`${venue}: «${e.title}» en «${e.place?.name ?? "sin lugar"}»`);
    // The same event can appear on the list page and on its own page: keep the richest (its own page, read later).
    const unique = [...new Map(all.map((e) => [e.externalId, e])).values()];
    ctx.log(`${unique.length} eventos${nightClubsOnly ? " en discotecas" : ""}`);
    return unique;
  },
  async fetchVenues(ctx) {
    // Ticketing agendas (followLinks) are read once, for their events.
    if ((ctx.config as Config).followLinks) return [];
    return (await nodes(ctx)).flatMap(({ page, nodes }) => jsonLdToVenues(nodes, page));
  },
};

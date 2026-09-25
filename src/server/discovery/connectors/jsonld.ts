import "server-only";
import { fetchText } from "../fetcher";
import { extractJsonLdBlocks, flattenNodes, jsonLdToEvents, jsonLdToVenues } from "../parsers/jsonld";
import type { Connector, SourceContext } from "../types";

/**
 * Official club/promoter pages that publish schema.org structured data.
 * Only the configured pages are read (no crawling), robots.txt is honoured.
 * config: { pages?: string[] } — defaults to the source URL.
 */
function pages(ctx: SourceContext): string[] {
  const extra = Array.isArray(ctx.config.pages) ? (ctx.config.pages as unknown[]).filter((p): p is string => typeof p === "string") : [];
  return [...new Set([ctx.url, ...extra].filter((p): p is string => Boolean(p)))].slice(0, 10);
}

async function nodes(ctx: SourceContext) {
  const out: Array<{ page: string; nodes: ReturnType<typeof flattenNodes> }> = [];
  for (const page of pages(ctx)) {
    const html = await fetchText(page, { accept: "text/html", respectRobots: true });
    const found = flattenNodes(extractJsonLdBlocks(html));
    ctx.log(`${page}: ${found.length} nodos JSON-LD`);
    out.push({ page, nodes: found });
  }
  if (!out.length) throw new Error("La fuente necesita al menos una URL");
  return out;
}

export const jsonLdConnector: Connector = {
  label: "Web oficial con datos estructurados (schema.org)",
  async fetchEvents(ctx) {
    return (await nodes(ctx)).flatMap(({ page, nodes }) => jsonLdToEvents(nodes, page, ctx.city.timezone));
  },
  async fetchVenues(ctx) {
    return (await nodes(ctx)).flatMap(({ page, nodes }) => jsonLdToVenues(nodes, page));
  },
};

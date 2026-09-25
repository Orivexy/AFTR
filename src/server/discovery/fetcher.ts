import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "../env";
import { site } from "@/config/site";
import { parseRobots, robotsPathAllowed } from "./parsers/robots";

/**
 * Polite, safe HTTP client for discovery sources:
 * - identifies itself with a bot User-Agent,
 * - refuses private/loopback addresses (SSRF) unless explicitly allowed,
 * - honours robots.txt for crawled web pages,
 * - throttles per host, times out and caps response size.
 * It never solves CAPTCHAs, logs in, or retries around blocks.
 */
export const USER_AGENT = `${site.name}Bot/1.0 (+${env.APP_URL}/about/bot)`;
const BOT_TOKEN = `${site.name.toLowerCase()}bot`;
const MIN_INTERVAL_MS = 1500;
const lastRequest = new Map<string, number>();

export class FetchError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v === "::" || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError(`URL no válida: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("Solo se permiten URLs http(s)");
  if (url.username || url.password) throw new FetchError("URLs con credenciales no permitidas");
  if (env.DISCOVERY_ALLOW_PRIVATE_HOSTS) return url;
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new FetchError(`No se pudo resolver ${url.hostname}`);
  if (addresses.some((a) => isPrivateIp(a.address))) throw new FetchError("Destino privado bloqueado");
  return url;
}

async function throttle(host: string) {
  const wait = (lastRequest.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest.set(host, Date.now());
}

interface FetchOptions {
  accept?: string;
  maxBytes?: number;
  timeoutMs?: number;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** Crawled pages must respect robots.txt; APIs and feeds given to us need not. */
  respectRobots?: boolean;
}

export async function fetchBytes(rawUrl: string, opts: FetchOptions = {}): Promise<{ body: Buffer; contentType: string; url: string }> {
  let url = await assertPublicUrl(rawUrl);
  if (opts.respectRobots && !(await robotsAllows(url))) throw new FetchError(`robots.txt no permite acceder a ${url.pathname}`);

  for (let hop = 0; hop < 4; hop++) {
    await throttle(url.host);
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept ?? "*/*", ...opts.headers },
      body: opts.body,
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (res.status === 429 || res.status === 403) throw new FetchError(`El servidor rechazó la petición (${res.status}); no se reintenta`);
    if (!res.ok) throw new FetchError(`HTTP ${res.status}`);
    const max = opts.maxBytes ?? 5 * 1024 * 1024;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > max) throw new FetchError("Respuesta demasiado grande");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
          await reader.cancel();
          throw new FetchError("Respuesta demasiado grande");
        }
        chunks.push(value);
      }
    }
    return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", url: url.toString() };
  }
  throw new FetchError("Demasiadas redirecciones");
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return (await fetchBytes(url, opts)).body.toString("utf8");
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, { accept: "application/json", ...opts });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new FetchError("La respuesta no es JSON válido");
  }
}

// ─── robots.txt (RFC 9309, simplified) ───────────────────────────────────────

const robotsCache = new Map<string, { at: number; rules: Array<{ allow: boolean; path: string }> | "all" | "none" }>();

async function robotsAllows(url: URL): Promise<boolean> {
  const cached = robotsCache.get(url.origin);
  let entry = cached && Date.now() - cached.at < 3600_000 ? cached : null;
  if (!entry) {
    try {
      await throttle(url.host);
      const res = await fetch(`${url.origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
      if (res.status >= 500) entry = { at: Date.now(), rules: "none" };
      else if (!res.ok) entry = { at: Date.now(), rules: "all" };
      else entry = { at: Date.now(), rules: parseRobots((await res.text()).slice(0, 500_000), BOT_TOKEN) };
    } catch {
      entry = { at: Date.now(), rules: "none" }; // unreachable robots.txt → be conservative
    }
    robotsCache.set(url.origin, entry);
  }
  if (entry.rules === "all") return true;
  if (entry.rules === "none") return false;
  return robotsPathAllowed(entry.rules, url.pathname + url.search);
}

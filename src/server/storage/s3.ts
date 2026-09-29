import "server-only";
import { createHash, createHmac } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import type { StorageDriver } from "./index";
import { assertKey, contentTypeFor } from "./keys";

/**
 * Minimal S3-compatible client (AWS Signature V4) — PUT, HEAD, GET with
 * Range, DELETE and ListObjectsV2. Works with AWS S3, Cloudflare R2, MinIO,
 * Backblaze B2 and any provider speaking the S3 API. No SDK dependency.
 */
export interface S3Config {
  bucket: string;
  region: string;
  /** Custom endpoint (path-style). Empty → AWS virtual-hosted style. */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();
/** RFC 3986 encoding, as SigV4 expects (slashes kept in object keys). */
const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encodeKey = (key: string) => key.split("/").map(encode).join("/");

export function canonicalQuery(query: Record<string, string>) {
  return Object.entries(query)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .join("&");
}

/** AWS Signature V4 for S3: returns the headers to send (incl. Authorization). */
export function signV4(input: { method: string; url: URL; headers: Record<string, string>; payloadHash: string; region: string; accessKeyId: string; secretAccessKey: string; date: Date }) {
  const amzDate = input.date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = { host: input.url.host, "x-amz-content-sha256": input.payloadHash, "x-amz-date": amzDate };
  for (const [k, v] of Object.entries(input.headers)) headers[k.toLowerCase()] = v;
  const names = Object.keys(headers).sort();
  const canonical = [
    input.method,
    input.url.pathname,
    input.url.search.replace(/^\?/, ""),
    names.map((n) => `${n}:${headers[n].trim()}\n`).join(""),
    names.join(";"),
    input.payloadHash,
  ].join("\n");
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope},SignedHeaders=${names.join(";")},Signature=${signature}`;
  return headers;
}

export class S3Error extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class S3Storage implements StorageDriver {
  constructor(private cfg: S3Config) {}

  private ensureConfigured() {
    const { bucket, accessKeyId, secretAccessKey } = this.cfg;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("STORAGE_DRIVER=s3 requiere S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY");
    }
  }

  private url(key: string, query = "") {
    const { endpoint, bucket, region } = this.cfg;
    const base = endpoint ? `${endpoint.replace(/\/$/, "")}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`;
    return new URL(`${base}/${encodeKey(key)}${query ? `?${query}` : ""}`);
  }

  /** Signed fetch (the payload is not hashed: UNSIGNED-PAYLOAD). */
  private async request(method: string, key: string, opts: { query?: Record<string, string>; body?: Buffer; headers?: Record<string, string> } = {}) {
    this.ensureConfigured();
    const query = canonicalQuery(opts.query ?? {});
    const url = this.url(key, query);
    const headers = signV4({
      method,
      url,
      headers: opts.headers ?? {},
      payloadHash: "UNSIGNED-PAYLOAD",
      region: this.cfg.region,
      accessKeyId: this.cfg.accessKeyId,
      secretAccessKey: this.cfg.secretAccessKey,
      date: new Date(),
    });
    delete headers.host;
    return fetch(url, {
      method,
      headers,
      body: opts.body ? new Uint8Array(opts.body) : undefined,
      signal: AbortSignal.timeout(method === "PUT" ? 120_000 : 30_000),
    });
  }

  private async fail(res: Response, what: string): Promise<never> {
    const text = await res.text().catch(() => "");
    const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1];
    throw new S3Error(`S3 ${what}: ${res.status}${code ? ` ${code}` : ""}`, res.status);
  }

  async put(key: string, data: Buffer) {
    assertKey(key);
    const res = await this.request("PUT", key, { body: data, headers: { "content-type": contentTypeFor(key) ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
    if (!res.ok) await this.fail(res, `PUT ${key}`);
  }

  async putFile(key: string, sourcePath: string) {
    await this.put(key, await readFile(sourcePath));
    await rm(sourcePath, { force: true });
  }

  async stat(key: string) {
    assertKey(key);
    const res = await this.request("HEAD", key);
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res, `HEAD ${key}`);
    return { size: Number(res.headers.get("content-length") ?? 0), mtime: new Date(res.headers.get("last-modified") ?? Date.now()) };
  }

  async read(key: string, range?: { start: number; end: number }) {
    assertKey(key);
    const res = await this.request("GET", key, range ? { headers: { range: `bytes=${range.start}-${range.end}` } } : {});
    if (!res.ok || !res.body) await this.fail(res, `GET ${key}`);
    return res.body!;
  }

  async delete(keys: string[]) {
    keys.forEach(assertKey);
    for (let i = 0; i < keys.length; i += 8) {
      await Promise.all(
        keys.slice(i, i + 8).map(async (k) => {
          const res = await this.request("DELETE", k);
          if (!res.ok && res.status !== 404) await this.fail(res, `DELETE ${k}`);
        }),
      );
    }
  }

  async *list(prefix: string) {
    let token: string | undefined;
    do {
      const res = await this.request("GET", "", { query: { "list-type": "2", prefix, "max-keys": "1000", ...(token ? { "continuation-token": token } : {}) } });
      if (!res.ok) await this.fail(res, "LIST");
      const xml = await res.text();
      for (const [, body] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = body.match(/<Key>([^<]+)<\/Key>/)?.[1];
        const modified = body.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
        if (key) yield { key: decodeXml(key), mtime: new Date(modified ?? Date.now()) };
      }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] : undefined;
      if (token) token = decodeXml(token);
    } while (token);
  }

  publicUrl(key: string) {
    return this.cfg.publicUrl ? `${this.cfg.publicUrl.replace(/\/$/, "")}/${encodeKey(key)}` : null;
  }
}

function decodeXml(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

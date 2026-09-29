import "server-only";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "../env";
import { S3Storage } from "./s3";
import { assertKey } from "./keys";

export { contentTypeFor } from "./keys";

/**
 * Storage abstraction: `local` writes to disk (single server / desktop),
 * `s3` writes to any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO…).
 * Files never go into PostgreSQL; the database only keeps their keys.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  putFile(key: string, sourcePath: string): Promise<void>;
  stat(key: string): Promise<{ size: number; mtime: Date } | null>;
  read(key: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array>>;
  delete(keys: string[]): Promise<void>;
  /** Every stored object under a prefix (for the orphan-file sweeper). */
  list(prefix: string): AsyncIterable<{ key: string; mtime: Date }>;
  /** Public URL when files are served straight from a CDN / public bucket. */
  publicUrl(key: string): string | null;
}

class LocalStorage implements StorageDriver {
  private root = path.resolve(env.STORAGE_LOCAL_DIR);

  /** Resolves a key to a path inside the storage root (no traversal). */
  private resolve(key: string): string {
    assertKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Path traversal");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async putFile(key: string, sourcePath: string) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      await rename(sourcePath, full);
    } catch {
      await copyFile(sourcePath, full);
      await rm(sourcePath, { force: true });
    }
  }

  async stat(key: string) {
    try {
      const s = await stat(this.resolve(key));
      return s.isFile() ? { size: s.size, mtime: s.mtime } : null;
    } catch {
      return null;
    }
  }

  async read(key: string, range?: { start: number; end: number }) {
    return Readable.toWeb(createReadStream(this.resolve(key), range)) as ReadableStream<Uint8Array>;
  }

  async delete(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.resolve(k), { force: true })));
  }

  async *list(prefix: string) {
    const dir = this.resolve(prefix.replace(/\/$/, ""));
    let entries;
    try {
      entries = await readdir(dir, { recursive: true, withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const full = path.join(e.parentPath, e.name);
      const s = await stat(full).catch(() => null);
      if (s) yield { key: path.relative(this.root, full).split(path.sep).join("/"), mtime: s.mtime };
    }
  }

  publicUrl() {
    return null;
  }
}

function createStorage(): StorageDriver {
  if (env.STORAGE_DRIVER !== "s3") return new LocalStorage();
  return new S3Storage({
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    publicUrl: env.S3_PUBLIC_URL,
  });
}

export const storage: StorageDriver = createStorage();

/** Status for the admin (never exposes credentials). */
export function storageStatus() {
  if (env.STORAGE_DRIVER === "s3") {
    const missing = (["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const).filter((k) => !env[k]);
    return { driver: "s3" as const, configured: missing.length === 0, missing, detail: env.S3_ENDPOINT ? new URL(env.S3_ENDPOINT).host : `AWS ${env.S3_REGION}` };
  }
  return { driver: "local" as const, configured: true, missing: [] as string[], detail: path.resolve(env.STORAGE_LOCAL_DIR) };
}

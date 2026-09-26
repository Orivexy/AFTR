import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "../env";

/**
 * Storage abstraction. `local` writes to disk; an S3/R2 driver only needs to
 * implement this interface (and `/media` can then redirect to signed URLs).
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  putFile(key: string, sourcePath: string): Promise<void>;
  stat(key: string): Promise<{ size: number; mtime: Date } | null>;
  read(key: string, range?: { start: number; end: number }): ReadableStream<Uint8Array>;
  delete(keys: string[]): Promise<void>;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

class LocalStorage implements StorageDriver {
  private root = path.resolve(env.STORAGE_LOCAL_DIR);

  /** Resolves a key to a path inside the storage root (no traversal). */
  private resolve(key: string): string {
    if (!KEY_RE.test(key) || key.includes("..")) throw new Error(`Invalid storage key: ${key}`);
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
      const { copyFile } = await import("node:fs/promises");
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

  read(key: string, range?: { start: number; end: number }) {
    const stream = createReadStream(this.resolve(key), range);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  async delete(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.resolve(k), { force: true })));
  }
}

export const storage: StorageDriver = new LocalStorage();

import "server-only";

/**
 * Fixed-window rate limiter. The in-memory store is fine for a single
 * instance; swap `store` for a Redis implementation when scaling out.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): { count: number; resetAt: number };
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  hit(key: string, windowMs: number) {
    const now = Date.now();
    if (now - this.lastSweep > 60_000) this.sweep(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    bucket.count += 1;
    return bucket;
  }

  private sweep(now: number) {
    for (const [key, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(key);
    this.lastSweep = now;
  }
}

const globalStore = globalThis as unknown as { __rateLimitStore?: RateLimitStore };
const store: RateLimitStore = (globalStore.__rateLimitStore ??= new MemoryStore());

export interface RateLimitRule {
  /** Max requests per window. */
  limit: number;
  windowMs: number;
}

/** Named rules so limits are tuned in one place. */
export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 40, windowMs: 60 * 60_000 },
  createEvent: { limit: 10, windowMs: 60 * 60_000 },
  createPost: { limit: 20, windowMs: 60 * 60_000 },
  comment: { limit: 30, windowMs: 10 * 60_000 },
  interaction: { limit: 300, windowMs: 10 * 60_000 },
  report: { limit: 20, windowMs: 60 * 60_000 },
  read: { limit: 600, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export function checkRateLimit(name: RateLimitName, identity: string) {
  const rule = RATE_LIMITS[name];
  const { count, resetAt } = store.hit(`${name}:${identity}`, rule.windowMs);
  return { ok: count <= rule.limit, retryAfterSec: Math.ceil((resetAt - Date.now()) / 1000) };
}

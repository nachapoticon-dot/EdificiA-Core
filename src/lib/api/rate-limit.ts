// In-memory rate limiter. Resets on cold start.
// For production at scale, replace the store with Redis/Upstash.

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window duration in ms */
  windowMs: number;
}

const PRESETS = {
  /** Default for most API routes */
  standard: { limit: 200, windowMs: 60_000 },
  /** Chat — expensive LLM calls */
  chat: { limit: 1_000, windowMs: 86_400_000 },
  /** File upload — disk/embedding cost */
  upload: { limit: 50, windowMs: 3_600_000 },
  /** Auth routes — brute-force protection */
  auth: { limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitOptions>;

export type RateLimitPreset = keyof typeof PRESETS;

/**
 * Returns true if the request is allowed, false if rate limited.
 * Key should be unique per user/IP per endpoint family.
 */
export function checkRateLimit(
  key: string,
  preset: RateLimitPreset | RateLimitOptions = "standard",
): boolean {
  const opts = typeof preset === "string" ? PRESETS[preset] : preset;
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  if (bucket.count >= opts.limit) return false;
  bucket.count++;
  return true;
}

/**
 * Extracts a rate-limit key from a Request.
 * Uses Bearer token suffix when present, falls back to IP.
 */
export function rateLimitKey(req: Request, prefix: string): string {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  return `${prefix}:${token ? `tok:${token.slice(-16)}` : `ip:${ip}`}`;
}

import { env } from "@/lib/env"

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  /** Attempts permitted inside one window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
  /** Injectable clock, so tests do not have to sleep. */
  now?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  /** Number of live buckets, exposed so tests can assert memory is bounded. */
  trackedKeys: number
}

type GlobalWithLimiter = typeof globalThis & {
  __authorizaRateLimit?: Map<string, Bucket>
}

// Pinned to globalThis for the same reason as the database pool: Next
// re-evaluates modules on hot reload, which would otherwise reset every
// counter on each file save.
const globalForLimiter = globalThis as GlobalWithLimiter

const buckets: Map<string, Bucket> =
  globalForLimiter.__authorizaRateLimit ?? new Map()

if (env.NODE_ENV !== "production") {
  globalForLimiter.__authorizaRateLimit = buckets
}

/** Discards finished windows so the map cannot grow without bound. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

/**
 * Counts one attempt against `key` and says whether it is allowed.
 *
 * This lives in process memory, which is a deliberate trade-off: it needs no
 * Redis and no extra service, but the counters reset when the server restarts,
 * are not shared between instances, and are close to useless on serverless
 * where each invocation may be a fresh isolate. It raises the cost of a naive
 * brute force; it is not a substitute for a durable limiter. Moving the counts
 * into Postgres is the upgrade path.
 */
export function consumeAttempt(
  key: string,
  { limit, windowMs, now = Date.now() }: RateLimitOptions
): RateLimitResult {
  sweep(now)

  const existing = buckets.get(key)
  const bucket: Bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs }

  const allowed = bucket.count < limit
  if (allowed) {
    bucket.count += 1
  }
  buckets.set(key, bucket)

  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    trackedKeys: buckets.size,
  }
}

/** Test seam. Clears every counter. */
export function resetRateLimits(): void {
  buckets.clear()
}

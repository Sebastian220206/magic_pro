/**
 * rateLimit.ts
 * Fixed-window rate limiting for API routes.
 *
 * Two implementations:
 *
 * - `consume` counts in process memory. Fast, needs nothing, and correct only
 *   on a single long-lived server.
 * - `consumeShared` counts in Postgres, so every instance sees one window.
 *
 * The shared one is what routes should use. On a serverless host each warm
 * instance keeps its own memory, so an in-process limit of 20/min becomes
 * 20/min *per instance* — the platform decides the real quota, and it rises
 * exactly when traffic does. For endpoints that bill per call to OpenAI, that
 * is the difference between a budget and a suggestion.
 */

import { ApiError } from './apiAuth';
import { prisma } from './prisma';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Evict expired windows so the map cannot grow without bound. */
function sweep(now: number): void {
  if (windows.size < 1000) return;
  for (const [key, window] of Array.from(windows.entries())) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitOptions {
  /** Maximum requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Record a request against `key` in this process and report whether it is
 * allowed.
 *
 * Prefer `consumeShared`. This remains for tests, for local development, and as
 * the fallback when the database is unreachable.
 */
export function consume(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    windows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, options.limit - existing.count);

  return {
    allowed: existing.count <= options.limit,
    remaining,
    resetAt: existing.resetAt,
  };
}

/** Logged once rather than per request, so a database outage cannot spam. */
let warnedAboutFallback = false;

/**
 * Record a request against `key` across every instance.
 *
 * One statement, because the read and the increment have to be atomic: two
 * concurrent requests that both read a count of 19 would both be allowed under
 * a read-then-write. `ON CONFLICT` makes the database resolve it.
 *
 * The same statement also rolls the window over. Whether it has expired is
 * decided by the database clock, so instances with skewed clocks still agree.
 *
 * Falls back to the in-process counter if the table is unreachable — most
 * usefully when code is deployed before its migration has run. A degraded limit
 * is much better than a 500 on every AI request.
 */
export async function consumeShared(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + options.windowMs);

  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitWindow" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitWindow"."resetAt" <= NOW() THEN 1
          ELSE "RateLimitWindow"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitWindow"."resetAt" <= NOW() THEN ${resetAt}
          ELSE "RateLimitWindow"."resetAt"
        END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];
    if (!row) return consume(key, options);

    // Postgres returns bigint-ish values through some drivers.
    const count = Number(row.count);

    return {
      allowed: count <= options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt: new Date(row.resetAt).getTime(),
    };
  } catch (error) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      console.error(
        '[rateLimit] Shared window unavailable, falling back to per-instance ' +
        'counters. Has the RateLimitWindow migration been applied?',
        error,
      );
    }
    return consume(key, options);
  }
}

/** Turn an exhausted window into a 429 with a usable retry hint. */
function refuse(result: RateLimitResult): never {
  const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  throw new ApiError(429, `Rate limit exceeded. Try again in ${seconds}s.`);
}

/**
 * Throw a 429 `ApiError` when `key` has exhausted its window, counting in this
 * process only.
 */
export function enforceRateLimit(key: string, options: RateLimitOptions): void {
  const result = consume(key, options);
  if (!result.allowed) refuse(result);
}

/**
 * Throw a 429 `ApiError` when `key` has exhausted its shared window.
 *
 * This is the one to use on anything that costs money.
 */
export async function enforceSharedRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<void> {
  const result = await consumeShared(key, options);
  if (!result.allowed) refuse(result);
}

/**
 * Delete expired windows.
 *
 * Rows are only rewritten when their key is used again, so a key that is never
 * seen twice would otherwise stay forever. Call from a scheduled job; it is not
 * on the request path because a limiter must stay cheap.
 */
export async function sweepSharedWindows(): Promise<number> {
  const { count } = await prisma.rateLimitWindow.deleteMany({
    where: { resetAt: { lte: new Date() } },
  });
  return count;
}

/** Budget for AI endpoints, which cost real money per call. */
export const AI_RATE_LIMIT: RateLimitOptions = { limit: 20, windowMs: 60_000 };

/** Budget for expensive upload/render endpoints. */
export const UPLOAD_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 };

/** Reset all in-process counters. Test-only. */
export function __resetRateLimits(): void {
  windows.clear();
  warnedAboutFallback = false;
}

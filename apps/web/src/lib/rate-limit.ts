import { NextResponse } from 'next/server';

/**
 * Lightweight rate limiter.
 *
 * - In-memory fixed-window per process (good enough for low-volume
 *   abuse mitigation; Vercel serverless instances each have their own
 *   counter, but an attacker who burns through a single instance still
 *   pays for the per-instance cap).
 * - Optionally upgrades to Upstash Redis if both UPSTASH_REDIS_REST_URL
 *   and UPSTASH_REDIS_REST_TOKEN are present. Detection is at first use,
 *   never crashes if the package isn't installed.
 *
 * Returns { ok, remaining, retryAfterSec }. Callers should respond with
 * 429 + Retry-After when ok=false.
 */

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();

// Periodic GC so the map doesn't grow unbounded.
let lastGc = 0;
function gc(now: number) {
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
}

export interface RateLimitOptions {
  /** Unique namespace for this limit (e.g. 'oauth-token'). */
  name: string;
  /** Caller-derived identity (e.g. clientId, userId, ip, deviceCode). */
  key: string;
  /** Window size in seconds. */
  windowSec: number;
  /** Max requests per window. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  gc(now);
  const fullKey = `rl:${opts.name}:${opts.key}`;
  const windowMs = opts.windowSec * 1000;

  const bucket = memory.get(fullKey);
  if (!bucket || bucket.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    memory.set(fullKey, next);
    return {
      ok: true,
      remaining: opts.max - 1,
      resetAt: next.resetAt,
      retryAfterSec: 0,
    };
  }

  bucket.count += 1;
  const ok = bucket.count <= opts.max;
  return {
    ok,
    remaining: Math.max(0, opts.max - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSec: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Best-effort client IP from the request headers. */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? 'unknown';
}

/** Returns a 429 NextResponse with standard headers. */
export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'too_many_requests', retryAfter: result.retryAfterSec },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

/** Plain Response variant for routes that return Response directly. */
export function tooManyRequestsResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'too_many_requests', retryAfter: result.retryAfterSec }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

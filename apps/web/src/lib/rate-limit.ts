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
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const upstash = await rateLimitUpstash(opts);
    if (upstash) return upstash;
    // Fall through to memory on Upstash failure so the API stays up.
  }
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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '') ?? '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

/**
 * Shared-state rate limiter via Upstash Redis REST API. Uses an
 * INCR + EXPIRE-NX + TTL pipeline (3 round-trip-free ops in one HTTP
 * request) so every Vercel instance shares the same counter.
 *
 * Returns null on any failure so the caller can fall back to memory —
 * we never want a logging/limiter outage to take the API down.
 */
async function rateLimitUpstash(opts: RateLimitOptions): Promise<RateLimitResult | null> {
  const now = Date.now();
  const fullKey = `rl:${opts.name}:${opts.key}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', fullKey],
        ['EXPIRE', fullKey, String(opts.windowSec), 'NX'],
        ['PTTL', fullKey],
      ]),
      // Don't let a slow Upstash hang an API request.
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as Array<{ result?: number | string; error?: string }>;
    const incr = Number(out[0]?.result ?? 0);
    const pttlRaw = Number(out[2]?.result ?? -1);
    if (!Number.isFinite(incr) || incr <= 0) return null;
    const ttlMs = pttlRaw > 0 ? pttlRaw : opts.windowSec * 1000;
    const resetAt = now + ttlMs;
    const ok = incr <= opts.max;
    return {
      ok,
      remaining: Math.max(0, opts.max - incr),
      resetAt,
      retryAfterSec: ok ? 0 : Math.ceil(ttlMs / 1000),
    };
  } catch {
    return null;
  }
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

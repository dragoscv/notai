import 'server-only';
import { NextResponse } from 'next/server';
import { db, sql } from '@notai/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const startedAt = Date.now();

/**
 * Public, multi-service status endpoint backing the /status page.
 *
 * Probes the dependencies whose availability directly maps to a
 * user-visible feature. Each probe has a 1.5s budget so a single
 * slow dependency can't make the whole page hang. No secrets are
 * leaked — only ok/degraded + latency.
 */
type ProbeResult = {
  name: string;
  description: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
};

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function probe(
  name: string,
  description: string,
  fn: () => Promise<void>,
): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    await fn();
    return { name, description, ok: true, latencyMs: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      name,
      description,
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      detail: err instanceof Error ? err.message : 'unknown',
    };
  }
}

async function probeDb() {
  await withTimeout(db.execute(sql`select 1`), 1500, 'db');
}

async function probeRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL not configured');
  // Lazy import so health endpoint stays cheap on cold start.
  const { default: IORedis } = await import('ioredis');
  const r = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await withTimeout(r.connect(), 1500, 'redis');
    await withTimeout(r.ping(), 1500, 'redis-ping');
  } finally {
    r.disconnect();
  }
}

async function probeResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
  // GET /domains is a cheap read; succeeds with 200 + JSON when the key is live.
  const res = await withTimeout(
    fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(1500),
    }),
    1500,
    'resend',
  );
  if (!res.ok) throw new Error(`resend HTTP ${res.status}`);
}

async function probeUpstash() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash not configured (using in-memory fallback)');
  }
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const res = await withTimeout(
    fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(1500),
    }),
    1500,
    'upstash',
  );
  if (!res.ok) throw new Error(`upstash HTTP ${res.status}`);
}

export async function GET() {
  const probes = await Promise.all([
    probe('database', 'Postgres (notes, accounts, sessions)', probeDb),
    probe('webhooks-queue', 'Redis (BullMQ webhook delivery)', probeRedis),
    probe('rate-limiter', 'Upstash Redis (shared rate limits)', probeUpstash),
    probe('email', 'Resend (transactional email)', probeResend),
  ]);

  const allOk = probes.every((p) => p.ok);
  const someOk = probes.some((p) => p.ok);
  const status = allOk ? 'operational' : someOk ? 'degraded' : 'down';

  return NextResponse.json(
    {
      status,
      version: APP_VERSION,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      at: new Date().toISOString(),
      probes,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        'cache-control': 'no-store',
        'x-status': status,
      },
    },
  );
}

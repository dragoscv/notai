import 'server-only';
import { NextResponse } from 'next/server';
import { db, sql } from '@notai/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const startedAt = Date.now();

/**
 * Public health check. Returns 200 with JSON when DB is reachable,
 * 503 otherwise. Designed for UptimeRobot / Better Stack / Cloud Run
 * probes — no secrets, no PII, no DB schema details.
 *
 * Shape:
 *   { status: "ok" | "degraded", version, uptimeSec, db: { ok, latencyMs } }
 */
export async function GET() {
  const t0 = performance.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  let dbError: string | undefined;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
    dbLatencyMs = Math.round(performance.now() - t0);
  } catch (err) {
    dbLatencyMs = Math.round(performance.now() - t0);
    dbError = err instanceof Error ? err.message : 'unknown';
  }

  const body = {
    status: dbOk ? 'ok' : 'degraded',
    version: APP_VERSION,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    db: { ok: dbOk, latencyMs: dbLatencyMs, ...(dbError ? { error: dbError } : {}) },
    at: new Date().toISOString(),
  } as const;

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: {
      'cache-control': 'no-store',
      // Helps L7 monitors that key off this header.
      'x-health': dbOk ? 'ok' : 'degraded',
    },
  });
}

export async function HEAD() {
  // Lightweight liveness: skip DB. K8s/Cloud Run readiness should use GET.
  return new Response(null, { status: 200, headers: { 'cache-control': 'no-store' } });
}

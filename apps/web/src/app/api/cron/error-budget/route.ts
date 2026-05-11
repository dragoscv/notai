import { NextRequest, NextResponse } from 'next/server';
import { db, apiRequestLog, sql } from '@notai/db';

/**
 * Daily error-budget cron. Computes the last 24h error rate from
 * `api_request_log` and posts a Slack alert when it exceeds
 * `ERROR_BUDGET_THRESHOLD` (default 0.01 = 1%). When the rate is
 * under threshold, posts nothing — Slack noise is reserved for real
 * regressions.
 *
 * Configure:
 *   ERROR_BUDGET_SLACK_WEBHOOK — Slack incoming-webhook URL.
 *   ERROR_BUDGET_THRESHOLD     — float in 0..1 (default 0.01).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const authorized =
    req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const webhook = process.env.ERROR_BUDGET_SLACK_WEBHOOK;
  const threshold = Number.parseFloat(process.env.ERROR_BUDGET_THRESHOLD ?? '0.01');
  if (!webhook) return NextResponse.json({ ok: true, skipped: 'no webhook configured' });
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    return NextResponse.json({ ok: false, error: 'invalid threshold' }, { status: 500 });
  }

  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      errors: sql<number>`COUNT(*) FILTER (WHERE ${apiRequestLog.status} >= 500)::int`,
    })
    .from(apiRequestLog)
    .where(sql`${apiRequestLog.createdAt} >= NOW() - INTERVAL '24 hours'`);

  const total = row?.total ?? 0;
  const errors = row?.errors ?? 0;
  const rate = total > 0 ? errors / total : 0;
  const exceeds = rate > threshold;

  if (!exceeds) {
    return NextResponse.json({ ok: true, total, errors, rate, threshold, alerted: false });
  }

  const text = `:rotating_light: *Error-budget breached* — ${(rate * 100).toFixed(2)}% over last 24h (${errors}/${total}). Threshold: ${(threshold * 100).toFixed(2)}%.`;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, total, errors, rate, threshold, error: (err as Error).message },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, total, errors, rate, threshold, alerted: true });
}

export const GET = handle;
export const POST = handle;

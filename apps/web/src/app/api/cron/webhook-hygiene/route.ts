import { NextResponse } from 'next/server';
import { db, webhookEndpoints, webhookDeliveries, eq, and, sql, lt } from '@notai/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Daily webhook hygiene job.
 *
 * - Auto-disables endpoints whose `failure_count` >= 20 AND that have
 *   never delivered a successful response (or whose `last_success_at`
 *   is older than 30 days). The endpoint is left in the database so
 *   the user can re-enable it after fixing their server; we don't
 *   delete.
 * - Prunes `webhook_deliveries` rows older than 30 days to keep the
 *   inspector page snappy and the table small.
 *
 * Authorize via `CRON_SECRET` Bearer header (Vercel cron passes this
 * automatically when configured). In dev with no `CRON_SECRET` set,
 * the route is open so a developer can hit it locally.
 */
function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const got = req.headers.get('authorization') ?? '';
  return got === `Bearer ${expected}`;
}

const FAILURE_THRESHOLD = 20;
const STALE_SUCCESS_DAYS = 30;
const DELIVERY_RETENTION_DAYS = 30;

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const staleCutoff = new Date(Date.now() - STALE_SUCCESS_DAYS * 24 * 60 * 60 * 1000);
  const deliveryCutoff = new Date(Date.now() - DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Auto-disable: high failure_count + (no success ever OR success
  // older than the stale window). Done in two queries to keep the
  // logic clear; the pool size is small enough that this is fine.
  const noSuccessDisabled = await db
    .update(webhookEndpoints)
    .set({ isActive: false })
    .where(
      and(
        eq(webhookEndpoints.isActive, true),
        sql`${webhookEndpoints.failureCount} >= ${FAILURE_THRESHOLD}`,
        sql`${webhookEndpoints.lastSuccessAt} IS NULL`,
      ),
    )
    .returning({ id: webhookEndpoints.id });

  const staleDisabled = await db
    .update(webhookEndpoints)
    .set({ isActive: false })
    .where(
      and(
        eq(webhookEndpoints.isActive, true),
        sql`${webhookEndpoints.failureCount} >= ${FAILURE_THRESHOLD}`,
        lt(webhookEndpoints.lastSuccessAt, staleCutoff),
      ),
    )
    .returning({ id: webhookEndpoints.id });

  const pruned = await db
    .delete(webhookDeliveries)
    .where(lt(webhookDeliveries.deliveredAt, deliveryCutoff))
    .returning({ id: webhookDeliveries.id });

  return NextResponse.json({
    ok: true,
    disabledNoSuccess: noSuccessDisabled.length,
    disabledStale: staleDisabled.length,
    deliveriesPruned: pruned.length,
  });
}

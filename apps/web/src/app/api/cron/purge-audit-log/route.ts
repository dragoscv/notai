import { NextRequest, NextResponse } from 'next/server';
import { db, auditLog, lt } from '@notai/db';

/**
 * Daily cron: deletes audit_log rows older than `AUDIT_LOG_RETENTION_DAYS`
 * (default 365). Set to 0 to disable pruning.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const authorized =
    req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const days = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '365', 10);
  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'retention disabled' });
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(auditLog)
    .where(lt(auditLog.createdAt, cutoff))
    .returning({ id: auditLog.id });
  return NextResponse.json({
    ok: true,
    deleted: deleted.length,
    cutoff: cutoff.toISOString(),
    retentionDays: days,
  });
}

export const GET = handle;
export const POST = handle;

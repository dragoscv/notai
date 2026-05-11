import { NextRequest, NextResponse } from 'next/server';
import { purgePendingDeletions } from '@/server/actions/account-deletion';

/**
 * Daily cron: hard-deletes users whose `deletion_requested_at` is older
 * than ACCOUNT_DELETION_GRACE_DAYS (default 30). Cascades wipe sessions,
 * accounts, notes, etc. via foreign-key constraints.
 *
 * Hit by Vercel Cron (configured in vercel.json) or any external scheduler
 * that sends `Authorization: Bearer ${CRON_SECRET}`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authorized =
    req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await purgePendingDeletions();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

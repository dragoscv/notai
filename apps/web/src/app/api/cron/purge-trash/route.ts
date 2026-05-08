import { NextRequest, NextResponse } from 'next/server';
import { purgeExpiredTrash } from '@/server/actions/notes';

/**
 * Daily cron: hard-deletes notes that have been in Trash for 30+ days.
 * Hit by Vercel Cron (configured in vercel.json) or any external scheduler
 * that sends `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Vercel Cron requests carry no Authorization, so we accept either:
 *   - the platform's `x-vercel-cron: 1` header, OR
 *   - a matching `CRON_SECRET` bearer.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authorized =
    req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await purgeExpiredTrash();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

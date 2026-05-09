import { NextResponse } from 'next/server';
import { db, notes, users, eq, and, isNull, sql } from '@notai/db';
import { env } from '@notai/lib';
import { localDateKey, dailyNoteTitle } from '@/server/daily-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily-note rollover. Designed to run hourly so each user gets their
 * note created shortly after midnight in their own timezone:
 *   - Pull every active user (last 7 days), grouped with their `timezone`.
 *   - Compute the local YYYY-MM-DD per user.
 *   - Skip users whose local hour is outside [0, 2] — we only want to
 *     spawn the note around their local midnight, not retroactively for
 *     every day they've been gone.
 *   - For users who pass the check, ensure today's note exists.
 *
 * Auth is shared with the other crons (Vercel cron header or
 * `CRON_SECRET` bearer).
 */
export async function GET(req: Request) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const auth = req.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  const authorized = cronHeader === '1' || (cronSecret ? auth === `Bearer ${cronSecret}` : false);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activeUsers = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(
      and(
        eq(users.status, 'active'),
        sql`COALESCE(${users.lastSeenAt}, ${users.createdAt}) >= ${sevenDaysAgo}`,
      ),
    );

  let created = 0;
  let skipped = 0;
  let outOfWindow = 0;
  for (const u of activeUsers) {
    const tz = u.timezone ?? 'UTC';
    const hour = localHour(tz, now);
    // Only fire near the user's local midnight. Hourly cron + a 3-hour
    // window means we'll catch every user even if Vercel skips a tick.
    if (hour > 2) {
      outOfWindow++;
      continue;
    }
    const title = dailyNoteTitle(localDateKey(tz, now));
    const [existing] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.ownerId, u.id), eq(notes.title, title), isNull(notes.deletedAt)))
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(notes).values({
      ownerId: u.id,
      title,
      icon: '📅',
      kind: 'note',
    });
    created++;
  }

  return NextResponse.json({
    ok: true,
    scanned: activeUsers.length,
    created,
    skipped,
    outOfWindow,
  });
}

function localHour(tz: string, when: Date): number {
  try {
    const h = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(when);
    return Number.parseInt(h, 10);
  } catch {
    return when.getUTCHours();
  }
}

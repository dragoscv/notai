import { NextResponse } from 'next/server';
import { db, notes, notifications, users, eq, and, isNull, sql } from '@notai/db';
import { env } from '@notai/lib';
import { localDateKey } from '@/server/daily-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily-digest in-app notification. Hourly cron, fires for users whose
 * local hour is in [8, 10] and who don't already have today's digest.
 * Counts notes the user touched in the previous 24h and inserts a
 * single `daily_digest` notification with `dateKey`, `editedCount`,
 * `createdCount`. Email channel is opt-in and lives in a separate
 * cron (deferred).
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

  let inserted = 0;
  let outOfWindow = 0;
  let skipped = 0;
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const u of activeUsers) {
    const tz = u.timezone ?? 'UTC';
    const hour = localHour(tz, now);
    if (hour < 8 || hour > 10) {
      outOfWindow++;
      continue;
    }
    const dateKey = localDateKey(tz, now);

    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, u.id),
          eq(notifications.kind, 'daily_digest'),
          sql`${notifications.payload}->>'dateKey' = ${dateKey}`,
        ),
      )
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }

    const [counts] = await db
      .select({
        edited: sql<number>`count(*) filter (where ${notes.updatedAt} >= ${oneDayAgo})`.mapWith(
          Number,
        ),
        created: sql<number>`count(*) filter (where ${notes.createdAt} >= ${oneDayAgo})`.mapWith(
          Number,
        ),
      })
      .from(notes)
      .where(and(eq(notes.ownerId, u.id), isNull(notes.deletedAt)));

    const editedCount = counts?.edited ?? 0;
    const createdCount = counts?.created ?? 0;
    if (editedCount === 0 && createdCount === 0) {
      skipped++;
      continue;
    }

    await db.insert(notifications).values({
      userId: u.id,
      kind: 'daily_digest',
      payload: { dateKey, editedCount, createdCount },
    });
    inserted++;
  }

  return NextResponse.json({
    ok: true,
    scanned: activeUsers.length,
    inserted,
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

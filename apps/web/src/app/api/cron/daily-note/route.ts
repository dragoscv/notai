import { NextResponse } from 'next/server';
import { db, notes, users, eq, and, isNull, sql } from '@notai/db';
import { env } from '@notai/lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily-note rollover. Runs once per UTC day. For every user who's been
 * active in the last 7 days, ensures today's "Daily — YYYY-MM-DD" note
 * exists. We deliberately keep this proactive (vs. lazy on first visit)
 * so the user lands on an instantly-available note when they open the
 * app first thing in the morning.
 *
 * Per-user timezone support is intentionally deferred — once we add
 * `users.timezone`, this cron can run hourly and only create notes for
 * users whose local clock just hit 00:00.
 */
export async function GET(req: Request) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const auth = req.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  const authorized = cronHeader === '1' || (cronSecret ? auth === `Bearer ${cronSecret}` : false);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const title = `Daily — ${yyyy}-${mm}-${dd}`;

  // Active users = anyone seen in the last 7 days; otherwise we'd
  // create empty notes for accounts that may never come back.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.status, 'active'),
        sql`COALESCE(${users.lastSeenAt}, ${users.createdAt}) >= ${sevenDaysAgo}`,
      ),
    );

  let created = 0;
  let skipped = 0;
  for (const u of activeUsers) {
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

  return NextResponse.json({ ok: true, title, scanned: activeUsers.length, created, skipped });
}

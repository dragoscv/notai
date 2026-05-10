'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, sql, desc } from '@notai/db';

export interface DayBucket {
  /** YYYY-MM-DD (UTC). */
  day: string;
  count: number;
}

export interface DayNote {
  id: string;
  title: string | null;
  icon: string | null;
  updatedAt: string;
}

/**
 * Counts of updated notes per day for a calendar grid month. The
 * caller supplies `year` and `month` (1-12); we widen the window to
 * cover the leading/trailing days of the surrounding weeks so the
 * client can render a full 6-row month grid without a second query.
 */
export async function getNotesByMonth(year: number, month: number): Promise<DayBucket[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  // Pad by ~7 days on each side so a Mon-start grid covers it.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - 7);
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + 7);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${notes.updatedAt}), 'YYYY-MM-DD')`.as('day'),
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, userId),
        sql`${notes.deletedAt} IS NULL`,
        sql`${notes.updatedAt} >= ${start.toISOString()}`,
        sql`${notes.updatedAt} < ${end.toISOString()}`,
      ),
    )
    .groupBy(sql`day`)
    .orderBy(sql`day`);

  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

/** Notes updated on a specific YYYY-MM-DD (UTC), newest first. */
export async function getNotesOnDay(day: string): Promise<DayNote[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, userId),
        sql`${notes.deletedAt} IS NULL`,
        sql`${notes.updatedAt} >= ${start.toISOString()}`,
        sql`${notes.updatedAt} < ${end.toISOString()}`,
      ),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? null,
    icon: r.icon ?? null,
    updatedAt: (r.updatedAt as Date).toISOString(),
  }));
}

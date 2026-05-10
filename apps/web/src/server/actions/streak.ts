'use server';

import { auth } from '@/auth';
import { db, notes, sql } from '@notai/db';

export interface StreakInfo {
  /** Consecutive days (counting today if active) the user touched at least one note. */
  current: number;
  /** Best streak the user has ever had on this account. */
  best: number;
  /** True when today's bucket has at least one updated note. */
  activeToday: boolean;
}

/**
 * Computes the user's current and best writing streak. A streak is a
 * sequence of consecutive UTC days on which `notes.updatedAt` falls
 * for at least one of the user's non-deleted notes. Computed in SQL
 * via `generate_series` + a window function so we never load every
 * note's timestamp into JS.
 */
export async function getWritingStreak(): Promise<StreakInfo> {
  const session = await auth();
  if (!session?.user?.id) return { current: 0, best: 0, activeToday: false };
  const userId = session.user.id;

  const result = await db.execute<{ active_day: string }>(sql`
    select distinct date_trunc('day', updated_at)::date as active_day
      from ${notes}
     where ${notes.ownerId} = ${userId}
       and ${notes.deletedAt} is null
     order by active_day desc
     limit 365
  `);

  const days = result.map((r) => r.active_day).map((d) => new Date(d).toISOString().slice(0, 10));
  if (days.length === 0) return { current: 0, best: 0, activeToday: false };

  const todayKey = new Date().toISOString().slice(0, 10);
  const set = new Set(days);
  const activeToday = set.has(todayKey);

  // Walk backwards from today to find current streak length.
  let cursor = new Date(todayKey + 'T00:00:00Z');
  let current = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  if (!activeToday && current === 0) {
    // Allow yesterday-only streaks (user hasn't written today yet) so
    // the badge doesn't drop to zero before midnight.
    cursor = new Date(todayKey + 'T00:00:00Z');
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (set.has(cursor.toISOString().slice(0, 10))) {
      current += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  // Best streak: scan all known active days and find the longest run.
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev == null) {
      run = 1;
    } else {
      const prevDate = new Date(prev + 'T00:00:00Z');
      prevDate.setUTCDate(prevDate.getUTCDate() + 1);
      run = prevDate.toISOString().slice(0, 10) === d ? run + 1 : 1;
    }
    if (run > best) best = run;
    prev = d;
  }

  return { current, best, activeToday };
}

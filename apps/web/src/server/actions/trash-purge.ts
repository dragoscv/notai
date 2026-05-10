'use server';

/**
 * Trash auto-purge: helpers + dashboard nudge data.
 *
 * Trash retention is 30 days. The actual scheduled purge happens via
 * the existing cron job, but this module exposes a manual count + a
 * one-shot "purge now" so the dashboard nudge card can show the user
 * how much storage is reclaimable and let them clear it on demand.
 */

import { db, notes, eq, and, isNotNull, sql } from '@notai/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const TRASH_RETENTION_DAYS = 30;

export interface PurgeableSummary {
  totalInTrash: number;
  purgeable: number;
  oldestDays: number | null;
}

export async function getPurgeableSummary(): Promise<PurgeableSummary> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return { totalInTrash: 0, purgeable: 0, oldestDays: null };
  const rows = await db.execute<{
    total: number;
    purgeable: number;
    oldest_days: number | null;
  }>(sql`
    select
      count(*)::int as total,
      count(*) filter (
        where ${notes.deletedAt} < now() - (${TRASH_RETENTION_DAYS} || ' days')::interval
      )::int as purgeable,
      extract(day from now() - min(${notes.deletedAt}))::int as oldest_days
    from ${notes}
    where ${notes.ownerId} = ${user.id}
      and ${notes.deletedAt} is not null
  `);
  const r = rows[0];
  return {
    totalInTrash: r?.total ?? 0,
    purgeable: r?.purgeable ?? 0,
    oldestDays: r?.oldest_days ?? null,
  };
}

/**
 * Hard-delete the user\u2019s trashed notes that are past the retention
 * window. Returns how many were removed.
 */
export async function purgeOldTrash(): Promise<{ purged: number }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return { purged: 0 };
  const result = await db
    .delete(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        isNotNull(notes.deletedAt),
        sql`${notes.deletedAt} < now() - (${TRASH_RETENTION_DAYS} || ' days')::interval`,
      ),
    )
    .returning({ id: notes.id });
  revalidatePath('/app/trash');
  revalidatePath('/app');
  return { purged: result.length };
}

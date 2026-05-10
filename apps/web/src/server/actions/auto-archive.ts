'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, notes, eq, and, isNull, sql } from '@notai/db';

const STALENESS_DAYS = 90;

export interface AutoArchiveResult {
  /** How many notes were archived. */
  archived: number;
  /** The note ids archived (for an Undo affordance). */
  archivedIds: string[];
}

/**
 * Mark every non-archived, non-trashed note that hasn't been touched
 * in 90+ days as `is_archived = true`. Returns the list of ids so the
 * UI can show an Undo toast. Idempotent.
 */
export async function autoArchiveStale(): Promise<AutoArchiveResult> {
  const session = await auth();
  if (!session?.user?.id) return { archived: 0, archivedIds: [] };
  const userId = session.user.id;

  const updated = await db
    .update(notes)
    .set({ isArchived: true })
    .where(
      and(
        eq(notes.ownerId, userId),
        eq(notes.isArchived, false),
        isNull(notes.deletedAt),
        sql`${notes.updatedAt} < now() - interval '${sql.raw(String(STALENESS_DAYS))} days'`,
      ),
    )
    .returning({ id: notes.id });

  revalidatePath('/app');
  return { archived: updated.length, archivedIds: updated.map((r) => r.id) };
}

/**
 * Restore a list of notes from the archive. Used as the Undo action
 * for a bulk auto-archive.
 */
export async function unarchiveMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;
  await db
    .update(notes)
    .set({ isArchived: false })
    .where(and(eq(notes.ownerId, userId), sql`${notes.id} = ANY(${ids})`));
  revalidatePath('/app');
}

/**
 * Count of notes that *would* be archived right now \u2014 used by the
 * dashboard nudge so we can hide the prompt when there's nothing to do.
 */
export async function countStaleArchivable(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const userId = session.user.id;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, userId),
        eq(notes.isArchived, false),
        isNull(notes.deletedAt),
        sql`${notes.updatedAt} < now() - interval '${sql.raw(String(STALENESS_DAYS))} days'`,
      ),
    );
  return Number(row?.n ?? 0);
}

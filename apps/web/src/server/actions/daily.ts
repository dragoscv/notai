'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, notes, users, eq, and, isNull } from '@notai/db';
import { requireQuota } from '@/server/plans';
import { localDateKey, dailyNoteTitle } from '@/server/daily-utils';

/**
 * Returns today's "Daily — YYYY-MM-DD" note for the current user, creating
 * it on first call. The title is the canonical lookup key (cheap and
 * human-readable) and we tag the note with the 📅 icon.
 *
 * "Today" is computed in the user's IANA timezone (synced from the
 * browser via `<TimezoneSync>` and stored in `users.timezone`). UTC
 * is used as a safe fallback when no timezone has been recorded yet.
 */
export async function getOrCreateDailyNote(): Promise<{ id: string; title: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;

  const [me] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const title = dailyNoteTitle(localDateKey(me?.timezone ?? null));

  const [existing] = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), eq(notes.title, title), isNull(notes.deletedAt)))
    .limit(1);
  if (existing) return existing;

  await requireQuota(userId, 'notes');
  const [row] = await db
    .insert(notes)
    .values({
      ownerId: userId,
      title,
      icon: '📅',
      kind: 'note',
    })
    .returning({ id: notes.id, title: notes.title });

  if (!row) throw new Error('Failed to create daily note');
  revalidatePath('/app');
  return row;
}

/** Server-action wrapper that redirects straight into today's daily note. */
export async function openDailyNote(): Promise<never> {
  const note = await getOrCreateDailyNote();
  redirect(`/app/n/${note.id}`);
}

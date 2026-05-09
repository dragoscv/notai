'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, notes, eq, and, isNull } from '@notai/db';
import { requireQuota } from '@/server/plans';

/**
 * Returns today's "Daily — YYYY-MM-DD" note for the current user, creating
 * it on first call. The title is the canonical lookup key (cheap and human
 * readable); we also tag the note with the 📅 icon so it stands out in
 * the sidebar and search results.
 *
 * Dates use UTC so the same calendar day resolves identically regardless
 * of where the user opens the app from. Per-user timezone support is a
 * follow-up once we add `users.timezone`.
 */
export async function getOrCreateDailyNote(): Promise<{ id: string; title: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;

  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const title = `Daily — ${yyyy}-${mm}-${dd}`;

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

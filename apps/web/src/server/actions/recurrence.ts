'use server';

import { auth } from '@/auth';
import { db, notes, eq, and } from '@notai/db';
import { rollRecurringTasks } from '@/lib/tasks';

/**
 * Inspect this note's plaintext mirror and return a single combined
 * block of next-occurrence open tasks for every completed recurring
 * task that doesn't already have its next instance present. Idempotent:
 * if every recurring task has already been rolled, returns an empty
 * string.
 *
 * The result is intentionally a single block of text (one line per
 * task) so the client can append it via `appendTextToScene` exactly
 * like the daily-rollover flow.
 */
export async function getRecurringRollText(noteId: string): Promise<{
  text: string;
  count: number;
}> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sign in required');

  const [row] = await db
    .select({ plaintext: notes.plaintext })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!row) return { text: '', count: 0 };

  const plain = row.plaintext ?? '';
  const { next, rolled } = rollRecurringTasks(plain);
  if (rolled === 0) return { text: '', count: 0 };

  // Compute the new lines added by `rollRecurringTasks` — diff naïvely.
  const before = new Set(plain.split('\n'));
  const newLines = next.split('\n').filter((l) => !before.has(l));
  return { text: newLines.join('\n'), count: rolled };
}

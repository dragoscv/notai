'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, isNotNull, desc } from '@notai/db';

/**
 * Last 5 notes the user opened, anywhere. Powers the "Continue where
 * you left off" dashboard card so a phone session picks up right after
 * a desktop one without bookmarking anything.
 */
export async function listRecentlyOpened(
  limit = 5,
): Promise<Array<{ id: string; title: string; icon: string | null; lastOpenedAt: Date }>> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      lastOpenedAt: notes.lastOpenedAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, session.user.id),
        isNull(notes.deletedAt),
        isNotNull(notes.lastOpenedAt),
      ),
    )
    .orderBy(desc(notes.lastOpenedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon,
    lastOpenedAt: r.lastOpenedAt!,
  }));
}

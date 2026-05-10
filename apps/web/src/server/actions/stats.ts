'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, sql } from '@notai/db';

export interface UserStats {
  totalNotes: number;
  totalArchived: number;
  totalFavorites: number;
  totalPinned: number;
  totalTrashed: number;
  notesLast7Days: number;
  notesLast30Days: number;
  /** Counts for the last 30 days, oldest first. */
  daily: Array<{ date: string; count: number }>;
  /** Top tags by usage. */
  topTags: Array<{ tag: string; count: number }>;
}

/**
 * Aggregate stats for the signed-in user. Single round-trip per
 * section; we lean on Postgres date_trunc + json aggregation rather
 * than pulling rows into Node.
 */
export async function getUserStats(): Promise<UserStats | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*) FILTER (WHERE ${notes.deletedAt} IS NULL AND ${notes.isArchived} = false)`,
      archived: sql<number>`COUNT(*) FILTER (WHERE ${notes.deletedAt} IS NULL AND ${notes.isArchived} = true)`,
      favorites: sql<number>`COUNT(*) FILTER (WHERE ${notes.deletedAt} IS NULL AND ${notes.isFavorite} = true)`,
      pinned: sql<number>`COUNT(*) FILTER (WHERE ${notes.deletedAt} IS NULL AND ${notes.isPinnedOnToday} = true)`,
      trashed: sql<number>`COUNT(*) FILTER (WHERE ${notes.deletedAt} IS NOT NULL)`,
      last7: sql<number>`COUNT(*) FILTER (WHERE ${notes.createdAt} >= NOW() - INTERVAL '7 days')`,
      last30: sql<number>`COUNT(*) FILTER (WHERE ${notes.createdAt} >= NOW() - INTERVAL '30 days')`,
    })
    .from(notes)
    .where(eq(notes.ownerId, userId));

  const dailyRows = await db.execute<{ d: string; c: number }>(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d,
           COUNT(*)::int AS c
      FROM notes
     WHERE owner_id = ${userId}
       AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY 1
     ORDER BY 1 ASC
  `);

  const tagRows = await db.execute<{ tag: string; c: number }>(sql`
    SELECT t.name AS tag, COUNT(*)::int AS c
      FROM tags t
      JOIN note_tags nt ON nt.tag_id = t.id
      JOIN notes n ON n.id = nt.note_id
     WHERE t.owner_id = ${userId}
       AND n.deleted_at IS NULL
     GROUP BY t.name
     ORDER BY c DESC
     LIMIT 12
  `);

  return {
    totalNotes: Number(counts?.total ?? 0),
    totalArchived: Number(counts?.archived ?? 0),
    totalFavorites: Number(counts?.favorites ?? 0),
    totalPinned: Number(counts?.pinned ?? 0),
    totalTrashed: Number(counts?.trashed ?? 0),
    notesLast7Days: Number(counts?.last7 ?? 0),
    notesLast30Days: Number(counts?.last30 ?? 0),
    daily: (dailyRows as unknown as { d: string; c: number | string }[]).map((r) => ({
      date: r.d,
      count: Number(r.c),
    })),
    topTags: (tagRows as unknown as { tag: string; c: number | string }[]).map((r) => ({
      tag: r.tag,
      count: Number(r.c),
    })),
  };
}

// Suppress unused warnings if helpers ever drop refs.
void and;
void isNull;

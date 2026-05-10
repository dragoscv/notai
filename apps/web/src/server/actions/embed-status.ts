'use server';

import { db, notes, eq, and, isNull, sql } from '@notai/db';
import { auth } from '@/auth';

/**
 * How many of the user\u2019s notes are still waiting on the embedding
 * worker to catch up. Drives the small "indexing\u2026" chip that lets
 * users know why Related-notes / Ask might be incomplete right now.
 *
 * We only count notes with non-trivial plaintext (\u2265 80 chars) because
 * tiny one-line notes intentionally don\u2019t embed.
 */
export async function getEmbedBacklog(): Promise<{ pending: number; total: number }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return { pending: 0, total: 0 };
  const rows = await db.execute<{ pending: number; total: number }>(sql`
    select
      count(*) filter (
        where ${notes.embedding} is null and length(coalesce(${notes.plaintext}, '')) >= 80
      )::int as pending,
      count(*) filter (
        where length(coalesce(${notes.plaintext}, '')) >= 80
      )::int as total
    from ${notes}
    where ${notes.ownerId} = ${user.id}
      and ${notes.deletedAt} is null
  `);
  void and;
  void eq;
  void isNull;
  return { pending: rows[0]?.pending ?? 0, total: rows[0]?.total ?? 0 };
}

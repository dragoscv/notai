'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notePresence, users, eq, and, sql, inArray } from '@notai/db';

const heartbeatSchema = z.object({ noteId: z.string().min(1) });

/**
 * Record that the signed-in user is actively viewing this note.
 * Call once on mount and every 30s thereafter. Also reaps presence
 * rows older than 5 minutes opportunistically so we don't need a
 * separate cron job.
 */
export async function heartbeatNotePresence(input: z.input<typeof heartbeatSchema>) {
  const session = await auth();
  if (!session?.user?.id) return;
  const { noteId } = heartbeatSchema.parse(input);
  const now = new Date();
  await db
    .insert(notePresence)
    .values({ userId: session.user.id, noteId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [notePresence.userId, notePresence.noteId],
      set: { lastSeenAt: now },
    });
  // Opportunistic reap of stale rows. 5-minute horizon.
  await db
    .delete(notePresence)
    .where(sql`${notePresence.lastSeenAt} < now() - interval '5 minutes'`);
}

export interface ActiveViewer {
  noteId: string;
  userId: string;
  name: string | null;
  image: string | null;
}

/**
 * Return active viewers on the given set of note ids (typically every
 * note in the graph the user can see). A row counts as active when
 * `last_seen_at > now() - 60 seconds`. Excludes the caller so the
 * graph's own pin doesn't make every node look "live".
 */
export async function listActiveViewers(noteIds: string[]): Promise<ActiveViewer[]> {
  if (noteIds.length === 0) return [];
  const session = await auth();
  if (!session?.user?.id) return [];
  const callerId = session.user.id;
  const safeIds = noteIds.slice(0, 5000); // hard cap

  const rows = await db
    .select({
      noteId: notePresence.noteId,
      userId: notePresence.userId,
      name: users.name,
      image: users.image,
    })
    .from(notePresence)
    .innerJoin(users, eq(users.id, notePresence.userId))
    .where(
      and(
        inArray(notePresence.noteId, safeIds),
        sql`${notePresence.lastSeenAt} > now() - interval '60 seconds'`,
        sql`${notePresence.userId} <> ${callerId}`,
      ),
    );
  return rows;
}

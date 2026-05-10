'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { embedText } from '@/server/openai';
import { requireQuota } from '@/server/plans';
import { apiCreateNote } from '@/server/notes-api';
import { db, notes, noteCollaborators, eq, and, or, sql, isNull } from '@notai/db';

const inputSchema = z.object({
  items: z.array(z.string().min(1).max(8000)).min(1).max(40),
});

export interface BatchedAppend {
  noteId: string;
  noteTitle: string;
  text: string;
}

export interface BatchedNew {
  id: string;
  title: string;
  count: number;
}

export interface QuickCaptureBatchResult {
  appends: BatchedAppend[];
  newNote: BatchedNew | null;
}

const SIMILARITY_THRESHOLD = 0.78;

/**
 * Given a list of free-form thoughts (one per non-empty paragraph from
 * the Quick Capture textarea), find the best existing destination note
 * for each — by cosine similarity on title+plaintext embeddings — and
 * return a routing plan. Items above the similarity threshold get
 * marked as appends to that note (the client carries them via the
 * `notai:pending-appends` localStorage handoff so the next visit to
 * each note picks up its own slice). Items below threshold get
 * bundled into a single fresh capture note.
 *
 * Why server-side: we already have the embedding pipeline + pgvector
 * index, so finding the top-1 destination per thought is a single
 * `<=>` query per item with no client-visible cost. The server NEVER
 * mutates the destination notes — append-via-Y.Doc still happens on
 * the client to avoid racing the realtime provider.
 */
export async function quickCaptureBatch(
  input: z.input<typeof inputSchema>,
): Promise<QuickCaptureBatchResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const parsed = inputSchema.parse(input);
  const items = parsed.items.map((s) => s.trim()).filter((s) => s.length > 0);
  if (items.length === 0) return { appends: [], newNote: null };

  await requireQuota(userId, 'ai');

  const appends: BatchedAppend[] = [];
  const orphans: string[] = [];

  for (const text of items) {
    // Skip semantic lookup for very short fragments — embedding noise
    // dominates and we'd misroute. Quote-and-route is reserved for
    // substantive thoughts.
    if (text.length < 40) {
      orphans.push(text);
      continue;
    }
    let bestId: string | null = null;
    let bestTitle: string | null = null;
    let bestSim = 0;
    try {
      const embed = await embedText(text, userId);
      if (!embed || !embed.embedding.length) {
        orphans.push(text);
        continue;
      }
      const literal = `[${embed.embedding.join(',')}]`;
      const distance = sql<number>`${notes.embedding} <=> ${literal}::vector`;
      const rows = await db
        .selectDistinct({
          id: notes.id,
          title: notes.title,
          distance,
        })
        .from(notes)
        .leftJoin(
          noteCollaborators,
          and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
        )
        .where(
          and(
            or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
            sql`${notes.embedding} is not null`,
            isNull(notes.deletedAt),
          ),
        )
        .orderBy(distance)
        .limit(1);
      const top = rows[0];
      if (top) {
        const sim = 1 - top.distance;
        if (sim >= SIMILARITY_THRESHOLD) {
          bestId = top.id;
          bestTitle = top.title;
          bestSim = sim;
        }
      }
    } catch {
      orphans.push(text);
      continue;
    }

    if (bestId && bestSim >= SIMILARITY_THRESHOLD) {
      appends.push({ noteId: bestId, noteTitle: bestTitle ?? 'Untitled', text });
    } else {
      orphans.push(text);
    }
  }

  let newNote: BatchedNew | null = null;
  if (orphans.length > 0) {
    const body = orphans.join('\n\n');
    const firstLine = (orphans[0] ?? '').split(/\r?\n/)[0]?.trim() ?? '';
    const title = firstLine.length > 0 ? firstLine.slice(0, 80) : 'Quick capture';
    const note = await apiCreateNote(userId, {
      title,
      icon: '⚡',
      kind: 'sticky',
      plaintext: body,
    });
    if (note) {
      newNote = { id: note.id, title: note.title ?? title, count: orphans.length };
    }
  }

  return { appends, newNote };
}

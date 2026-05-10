'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull, sql } from '@notai/db';
import { embedText } from '@/server/openai';
import { requireQuota } from '@/server/plans';

const inputSchema = z.object({
  text: z.string().min(40).max(8000),
  topK: z.number().min(1).max(5).optional(),
});

export interface DestinationMatch {
  id: string;
  title: string | null;
  similarity: number;
  snippet: string;
}

/**
 * Phase-3 of the AI quick-capture: given a fresh thought (typed, dictated,
 * or auto-transcribed from Meeting Mode), find the user's existing notes
 * most semantically similar to that thought. The caller can then offer
 * "Append to <title>" affordances instead of always creating a new note.
 *
 * Returns at most `topK` matches above a similarity threshold (0.78
 * cosine similarity, equivalent to cosine distance < 0.22). Below that
 * threshold the suggestion is too noisy to surface and we return [].
 */
export async function suggestQuickCaptureDestination(
  input: z.input<typeof inputSchema>,
): Promise<DestinationMatch[]> {
  const { text, topK = 3 } = inputSchema.parse(input);
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const me = session.user as { id: string };
  await requireQuota(me.id, 'ai');

  const embed = await embedText(text, me.id);
  if (!embed || !embed.embedding.length) return [];
  const literal = `[${embed.embedding.join(',')}]`;

  const distance = sql<number>`${notes.embedding} <=> ${literal}::vector`;

  const rows = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
      distance,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, me.id)),
    )
    .where(
      and(
        or(eq(notes.ownerId, me.id), eq(noteCollaborators.userId, me.id)),
        isNull(notes.deletedAt),
        sql`${notes.embedding} IS NOT NULL`,
      ),
    )
    .orderBy(distance)
    .limit(topK);

  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      similarity: 1 - Number(r.distance),
      snippet: (r.plaintext ?? '').slice(0, 160),
    }))
    .filter((m) => m.similarity >= 0.78);
}

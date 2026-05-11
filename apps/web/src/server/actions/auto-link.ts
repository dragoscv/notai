'use server';

import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull, sql, ne } from '@notai/db';

export interface AutoLinkSuggestion {
  id: string;
  title: string | null;
  icon: string | null;
  distance: number;
}

const MAX_DISTANCE = 0.3; // Stricter than related-notes' 0.45 — only
//                            strong semantic neighbours are worth
//                            interrupting the writer with a suggestion.
const TOP_K = 4;

/**
 * Suggest notes that this note SHOULD probably link to via `[[…]]`,
 * based on pgvector cosine similarity. Filters out any candidate whose
 * title already appears in the source note's plaintext (heuristic for
 * "already linked"). Returns empty when the embedding worker hasn't
 * caught up yet or there are no strong neighbours.
 */
export async function suggestAutoLinks(noteId: string): Promise<AutoLinkSuggestion[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const [src] = await db
    .select({
      id: notes.id,
      embedding: notes.embedding,
      plaintext: notes.plaintext,
    })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!src || !src.embedding) return [];

  const literal = `[${(src.embedding as unknown as number[]).join(',')}]`;
  const distance = sql<number>`${notes.embedding} <=> ${literal}::vector`;

  const rows = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      score: distance,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        ne(notes.id, noteId),
        isNull(notes.deletedAt),
        sql`${notes.embedding} IS NOT NULL`,
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .orderBy(distance)
    .limit(TOP_K * 3);

  const plaintext = (src.plaintext ?? '').toLowerCase();
  return rows
    .filter((r) => Number(r.score) <= MAX_DISTANCE)
    .filter((r) => {
      const t = (r.title ?? '').trim().toLowerCase();
      // Skip candidates whose title is already mentioned in this note.
      return t.length > 0 && !plaintext.includes(t);
    })
    .slice(0, TOP_K)
    .map((r) => ({
      id: r.id,
      title: r.title ?? null,
      icon: r.icon ?? null,
      distance: Number(r.score),
    }));
}

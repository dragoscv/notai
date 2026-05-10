'use server';

import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull, sql, ne } from '@notai/db';

export interface RelatedNote {
  id: string;
  title: string | null;
  icon: string | null;
  /** Cosine distance, 0 = identical. We pass it through so the UI can
   *  render a tiny strength indicator if desired. */
  distance: number;
}

const MAX_DISTANCE = 0.45; // cosine distance \u2014 anything farther is noise.
const TOP_K = 6;

/**
 * Find notes related to the given note via pgvector cosine similarity
 * over `notes.embedding`. Skips notes without an embedding yet (the
 * embed-worker hasn't caught up). Excludes the source note itself
 * and anything beyond `MAX_DISTANCE` so the rail stays signal-only.
 */
export async function getRelatedNotes(noteId: string): Promise<RelatedNote[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  // Pull the source note's embedding. Bail early if there isn't one
  // yet \u2014 the worker queues new notes with an embed pass; until then
  // we have nothing to compare against.
  const [src] = await db
    .select({ id: notes.id, embedding: notes.embedding })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!src || !src.embedding) return [];

  // Cast through unknown so Drizzle's column type stays out of the
  // way \u2014 the embedding is a number[] either way at runtime.
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
    .limit(TOP_K);

  return rows
    .filter((r) => Number(r.score) <= MAX_DISTANCE)
    .map((r) => ({
      id: r.id,
      title: r.title ?? null,
      icon: r.icon ?? null,
      distance: Number(r.score),
    }));
}

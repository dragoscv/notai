'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, sql, isNull } from '@notai/db';
import { embedText } from '@/server/openai';

const querySchema = z.string().trim().min(1).max(200);

export interface SearchHit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  preview: string;
  isPinned: boolean;
  rank: number;
}

/**
 * Server-side search across the user's owned + shared notes. Uses the
 * GIN trigram index on `notes.plaintext` plus a similarity score on the
 * title for a cheap, accurate ranking. Excludes soft-deleted rows.
 */
export async function searchNotes(
  rawQuery: string,
  filters?: { pinnedOnly?: boolean; favoritesOnly?: boolean; stickiesOnly?: boolean },
): Promise<SearchHit[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) return [];
  const q = parsed.data;
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  // We rank with: title similarity (heaviest) + plaintext similarity +
  // a small recency boost. ts_rank would be richer but we'd need a
  // tsvector column — trgm `similarity()` keeps the schema lean.
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      isPinned: notes.isPinned,
      plaintext: notes.plaintext,
      rank: sql<number>`
        (similarity(${notes.title}, ${q}) * 3.0)
        + similarity(left(${notes.plaintext}, 4000), ${q})
        + (1.0 / (1 + extract(epoch from now() - ${notes.updatedAt}) / 86400.0)) * 0.2
      `.as('rank'),
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        eq(notes.isEncrypted, false),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
        or(sql`${notes.title} ILIKE ${like}`, sql`${notes.plaintext} ILIKE ${like}`),
        filters?.pinnedOnly ? eq(notes.isPinned, true) : undefined,
        filters?.favoritesOnly ? eq(notes.isFavorite, true) : undefined,
        filters?.stickiesOnly ? eq(notes.kind, 'sticky') : undefined,
      ),
    )
    .orderBy(sql`rank DESC`)
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon,
    isPinned: r.isPinned,
    rank: Number(r.rank),
    snippet: makeSnippet(r.plaintext, q),
    preview: makePreview(r.plaintext, q),
  }));
}

/**
 * Hybrid search: trigram lexical results merged with pgvector semantic
 * neighbours when the user has an embedding provider configured. The
 * lexical pass is authoritative for ranking; semantic hits that aren't
 * already in the lexical set are appended at lower priority. Falls
 * back to plain `searchNotes` when no embedding can be produced (e.g.
 * BYOK key missing) so we never block on AI for a search box.
 */
export async function searchNotesHybrid(
  rawQuery: string,
  filters?: { pinnedOnly?: boolean; favoritesOnly?: boolean; stickiesOnly?: boolean },
): Promise<SearchHit[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) return [];
  const q = parsed.data;

  const [lexical, embedding] = await Promise.all([
    searchNotes(rawQuery, filters),
    embedText(q, userId).catch(() => null),
  ]);

  if (!embedding?.embedding?.length) return lexical;

  const literal = `[${embedding.embedding.join(',')}]`;
  const distance = sql<number>`${notes.embedding} <=> ${literal}::vector`;
  const lexicalIds = new Set(lexical.map((r) => r.id));

  const semantic = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      isPinned: notes.isPinned,
      plaintext: notes.plaintext,
      score: distance,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        eq(notes.isEncrypted, false),
        sql`${notes.embedding} IS NOT NULL`,
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
        filters?.pinnedOnly ? eq(notes.isPinned, true) : undefined,
        filters?.favoritesOnly ? eq(notes.isFavorite, true) : undefined,
        filters?.stickiesOnly ? eq(notes.kind, 'sticky') : undefined,
        // Skip ones already in the lexical set — the loop appends them
        // below at lower priority.
        lexicalIds.size > 0
          ? sql`${notes.id} NOT IN (${sql.join(
              [...lexicalIds].map((id) => sql`${id}`),
              sql`, `,
            )})`
          : undefined,
      ),
    )
    .orderBy(distance)
    .limit(10);

  const semanticHits: SearchHit[] = semantic
    .filter((r) => Number(r.score) <= 0.45)
    .map((r) => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      isPinned: r.isPinned,
      // Pin semantic-only hits below the lexical bottom (lexical ranks
      // are positive trgm scores, semantic distance is 0..1 inverted).
      rank: -1 - Number(r.score),
      snippet: makeSnippet(r.plaintext, q),
      preview: makePreview(r.plaintext, q),
    }));

  return [...lexical, ...semanticHits];
}

/** Returns ~140 chars around the first match, ellipsised. */
function makeSnippet(text: string, q: string): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, 140) + (text.length > 140 ? '…' : '');
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + q.length + 90);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

/** ~600 chars of context for the hover preview pane. */
function makePreview(text: string, q: string): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, 600) + (text.length > 600 ? '…' : '');
  const start = Math.max(0, idx - 200);
  const end = Math.min(text.length, idx + q.length + 400);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

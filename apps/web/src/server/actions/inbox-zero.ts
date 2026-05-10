'use server';

import { auth } from '@/auth';
import { db, notes, folders, eq, and, isNull, sql, desc } from '@notai/db';

export interface UnfiledSuggestion {
  noteId: string;
  noteTitle: string | null;
  noteIcon: string | null;
  notePlaintext: string;
  noteUpdatedAt: Date;
  /** Best-fit folder, or null when no folder cleared the threshold. */
  suggestedFolderId: string | null;
  suggestedFolderName: string | null;
  /** Cosine similarity of the note's embedding to the folder centroid (0..1). */
  similarity: number | null;
}

const SIMILARITY_THRESHOLD = 0.55;
const MAX_UNFILED = 50;

/**
 * Inbox Zero: every note with `folderId IS NULL` (unfiled), paired with
 * the user's folder whose centroid (mean embedding of its existing
 * notes) is closest in cosine similarity. Folders without any embedded
 * notes are skipped — they have no centroid yet.
 *
 * Runs entirely in SQL via pgvector: per-folder centroid computed in a
 * CTE, then a lateral cross-join picks the closest folder per unfiled
 * note. A single round-trip; no per-note loop in JS.
 */
export async function suggestFoldersForUnfiled(): Promise<UnfiledSuggestion[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;

  // Centroid per folder: AVG(embedding) treated as a vector. Using
  // sum/count via array_agg + helper is messy; pgvector ships AVG()
  // for vector type since 0.5.0 (Cloud SQL 17 ships 0.7+). We embed
  // the SQL inline so the planner can use the existing HNSW index for
  // the unfiled-note side.
  const rows = await db.execute<{
    note_id: string;
    note_title: string | null;
    note_icon: string | null;
    note_plaintext: string | null;
    note_updated_at: Date;
    folder_id: string | null;
    folder_name: string | null;
    similarity: number | null;
  }>(sql`
    with folder_centroids as (
      select f.id as folder_id,
             f.name as folder_name,
             avg(n.embedding) as centroid
        from ${folders} f
        join ${notes} n
          on n.folder_id = f.id
         and n.owner_id = ${userId}
         and n.deleted_at is null
         and n.embedding is not null
       where f.owner_id = ${userId}
       group by f.id, f.name
      having count(n.id) >= 1
    ),
    unfiled as (
      select n.id, n.title, n.icon, n.plaintext, n.updated_at, n.embedding
        from ${notes} n
       where n.owner_id = ${userId}
         and n.folder_id is null
         and n.deleted_at is null
       order by n.updated_at desc
       limit ${MAX_UNFILED}
    )
    select u.id           as note_id,
           u.title        as note_title,
           u.icon         as note_icon,
           u.plaintext    as note_plaintext,
           u.updated_at   as note_updated_at,
           best.folder_id as folder_id,
           best.folder_name as folder_name,
           best.similarity as similarity
      from unfiled u
      left join lateral (
        select fc.folder_id,
               fc.folder_name,
               1 - (u.embedding <=> fc.centroid) as similarity
          from folder_centroids fc
         where u.embedding is not null
         order by u.embedding <=> fc.centroid asc
         limit 1
      ) best on true
     order by u.updated_at desc
  `);

  return rows.map((r) => {
    const sim = r.similarity == null ? null : Number(r.similarity);
    const passes = sim != null && sim >= SIMILARITY_THRESHOLD;
    return {
      noteId: r.note_id,
      noteTitle: r.note_title,
      noteIcon: r.note_icon,
      notePlaintext: (r.note_plaintext ?? '').slice(0, 200),
      noteUpdatedAt: r.note_updated_at,
      suggestedFolderId: passes ? r.folder_id : null,
      suggestedFolderName: passes ? r.folder_name : null,
      similarity: sim,
    };
  });
}

/**
 * Lightweight count for the sidebar badge — same query as above but
 * returning only the unfiled-note count, no centroid math.
 */
export async function countUnfiled(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const userId = session.user.id;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.folderId), isNull(notes.deletedAt)))
    .orderBy(desc(notes.updatedAt));
  return row?.count ?? 0;
}

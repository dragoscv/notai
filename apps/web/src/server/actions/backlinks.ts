'use server';

import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, sql, isNull } from '@notai/db';
import { revalidatePath } from 'next/cache';
import { requireQuota } from '@/server/plans';

interface BacklinkHit {
  id: string;
  title: string;
}

/** Quick title-only search used by the `[[` autocomplete. */
export async function searchBacklinkCandidates(query: string): Promise<BacklinkHit[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const q = (query ?? '').trim().slice(0, 80);
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const rows = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
        q.length === 0 ? sql`true` : sql`${notes.title} ILIKE ${like}`,
      ),
    )
    .orderBy(notes.updatedAt)
    .limit(8);
  return rows;
}

/** Returns notes that link to `noteId` via the `[[` mention extension. */
export async function listIncomingBacklinks(noteId: string): Promise<BacklinkHit[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  // The Y.Doc / Tiptap node serialises as `data-backlink="<id>"` in saved
  // HTML, but we don't have that HTML on the server. Instead we search the
  // `plaintext` mirror for the `<id>` substring as a heuristic — Tiptap
  // emits the linked title which doesn't include the id, so we use the
  // separate Y.Doc walk only when needed. This is a cheap MVP that catches
  // most cases (titles tend to be unique inside a workspace).
  const [target] = await db
    .select({ title: notes.title })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!target?.title) return [];
  const like = `%${target.title.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
        sql`${notes.id} <> ${noteId}`,
        sql`${notes.plaintext} ILIKE ${like}`,
      ),
    )
    .limit(20);
  return rows;
}

/**
 * Create a new note with the given title and return enough info for the
 * editor to insert a backlink to it. Used by the `[[…]]` autocomplete
 * when the user picks the synthetic "Create '<title>'" item.
 */
export async function createNoteFromBacklink(title: string): Promise<BacklinkHit> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const safeTitle = (title ?? '').trim().slice(0, 200) || 'Untitled';

  await requireQuota(userId, 'notes');

  const [note] = await db
    .insert(notes)
    .values({
      ownerId: userId,
      title: safeTitle,
      kind: 'note',
    })
    .returning({ id: notes.id, title: notes.title });

  if (!note) throw new Error('Failed to create note');
  revalidatePath('/app');
  return { id: note.id, title: note.title };
}

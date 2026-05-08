'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import {
  db,
  noteVersions,
  notes,
  noteCollaborators,
  eq,
  and,
  or,
  desc,
} from '@notai/db';

async function requireUserAccess(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const me = session.user as { id: string };
  const [row] = await db
    .select({ id: notes.id })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(
        eq(noteCollaborators.noteId, notes.id),
        eq(noteCollaborators.userId, me.id),
      ),
    )
    .where(
      and(
        eq(notes.id, noteId),
        or(eq(notes.ownerId, me.id), eq(noteCollaborators.userId, me.id)),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Note not found');
  return me.id;
}

const idSchema = z.string().min(1);

/** List snapshots for a note. Newest first. */
export async function listVersions(noteId: string) {
  await requireUserAccess(idSchema.parse(noteId));
  return db
    .select({
      id: noteVersions.id,
      authorId: noteVersions.authorId,
      sizeBytes: noteVersions.sizeBytes,
      label: noteVersions.label,
      createdAt: noteVersions.createdAt,
      preview: noteVersions.plaintext,
    })
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt))
    .limit(60);
}

/**
 * Replace the current note's Y.Doc state with the snapshot's. Active
 * Hocuspocus sessions will pick this up on next reload — we also bump
 * `updatedAt` so the realtime server treats it as a fresh edit.
 */
export async function restoreVersion(input: { noteId: string; versionId: string }) {
  const userId = await requireUserAccess(idSchema.parse(input.noteId));
  void userId;
  const [snap] = await db
    .select({
      yjsState: noteVersions.yjsState,
      plaintext: noteVersions.plaintext,
    })
    .from(noteVersions)
    .where(
      and(
        eq(noteVersions.id, input.versionId),
        eq(noteVersions.noteId, input.noteId),
      ),
    )
    .limit(1);
  if (!snap) throw new Error('Version not found');
  await db
    .update(notes)
    .set({
      yjsState: snap.yjsState,
      plaintext: snap.plaintext,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, input.noteId));
  revalidatePath(`/app/n/${input.noteId}`);
}

export async function deleteVersion(input: { noteId: string; versionId: string }) {
  await requireUserAccess(idSchema.parse(input.noteId));
  await db
    .delete(noteVersions)
    .where(
      and(
        eq(noteVersions.id, input.versionId),
        eq(noteVersions.noteId, input.noteId),
      ),
    );
  revalidatePath(`/app/n/${input.noteId}`);
}

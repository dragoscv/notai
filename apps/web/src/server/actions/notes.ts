'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  notes,
  eq,
  and,
  desc,
  asc,
  or,
  noteCollaborators,
  folders,
  isNull,
  isNotNull,
  lt,
} from '@notai/db';
import { requireQuota } from '@/server/plans';

/** Position gap between siblings so reorders don't have to renumber neighbours. */
const POSITION_STEP = 1000;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  return session.user;
}

export async function listNotes(filter?: { archived?: boolean; favorite?: boolean }) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(notes)
    .where(
      and(
        or(eq(notes.ownerId, user.id)),
        isNull(notes.deletedAt),
        eq(notes.isArchived, filter?.archived ?? false),
        ...(filter?.favorite ? [eq(notes.isFavorite, true)] : []),
      ),
    )
    // Sidebar groups notes by folder and uses `position` within each;
    // pinned notes still float to the top visually. The outer query
    // keeps it sorted by position so UI can just bucket into folders.
    .orderBy(desc(notes.isPinned), asc(notes.position), desc(notes.updatedAt));

  return rows.map((n) => ({ ...n, previewHtml: buildPreviewHtml(n.plaintext) }));
}

/** Escape HTML, truncate, and convert blank lines into <p> blocks for card previews. */
function buildPreviewHtml(plaintext: string): string {
  const trimmed = (plaintext ?? '').slice(0, 600).trim();
  if (!trimmed) return '';
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  return trimmed
    .split(/\n{2,}/)
    .map((p) => `<p>${escape(p).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export async function getNote(id: string) {
  const user = await requireUser();
  const [note] = await db
    .select()
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, user.id)),
    )
    .where(
      and(
        eq(notes.id, id),
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, user.id), eq(noteCollaborators.userId, user.id)),
      ),
    )
    .limit(1);
  return note?.notes ?? null;
}

const createSchema = z.object({
  title: z.string().max(200).optional().default('Untitled'),
  icon: z.string().max(10).optional(),
  kind: z.enum(['note', 'sticky']).optional().default('note'),
  folderId: z.string().nullable().optional(),
});

export async function createNote(input: z.input<typeof createSchema> = {}) {
  const user = await requireUser();
  const data = createSchema.parse(input);

  await requireQuota(user.id, 'notes');

  // Give the new note a `position` larger than any sibling in the same
  // folder so it lands at the bottom of the list; the sidebar can later
  // reorder it via `reorderNotes`. Using POSITION_STEP gaps keeps future
  // inserts cheap without rewriting neighbours.
  const siblings = await db
    .select({ position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        data.folderId ? eq(notes.folderId, data.folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(desc(notes.position))
    .limit(1);
  const position = (siblings[0]?.position ?? 0) + POSITION_STEP;

  const [note] = await db
    .insert(notes)
    .values({
      ownerId: user.id,
      title: data.title,
      icon: data.icon,
      kind: data.kind,
      folderId: data.folderId ?? null,
      position,
    })
    .returning();
  revalidatePath('/app');
  return note;
}

const updateSchema = z.object({
  id: z.string(),
  title: z.string().max(200).optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z.string().max(30).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export async function updateNote(input: z.input<typeof updateSchema>) {
  const user = await requireUser();
  const { id, ...patch } = updateSchema.parse(input);
  await db
    .update(notes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
  revalidatePath('/app');
  revalidatePath(`/app/n/${id}`);
}

/**
 * Soft delete: stamp `deletedAt` so the row disappears from normal
 * queries but stays recoverable for 30 days. The cron purger does the
 * actual DROP. Only owners can delete.
 */
export async function deleteNote(id: string) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNull(notes.deletedAt)));
  revalidatePath('/app');
  revalidatePath('/app/trash');
}

/** Move a soft-deleted note back to the active workspace. */
export async function restoreNote(id: string) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)));
  revalidatePath('/app');
  revalidatePath('/app/trash');
}

/** Permanently delete a single trashed note. Triggers Y.Doc cascade. */
export async function purgeNote(id: string) {
  const user = await requireUser();
  await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)));
  revalidatePath('/app/trash');
}

/** Permanently empty the user's trash (irreversible). */
export async function emptyTrash() {
  const user = await requireUser();
  await db.delete(notes).where(and(eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)));
  revalidatePath('/app/trash');
}

/** List the signed-in user's trashed notes. */
export async function listTrash() {
  const user = await requireUser();
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.ownerId, user.id), isNotNull(notes.deletedAt)))
    .orderBy(desc(notes.deletedAt));
}

/**
 * Cron-callable global purge: hard-deletes any note soft-deleted more than
 * 30 days ago, regardless of owner. Returns the count for logs.
 */
export async function purgeExpiredTrash(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(notes)
    .where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoff)))
    .returning({ id: notes.id });
  return { purged: rows.length };
}

/**
 * Duplicate a note into the same folder. Copies title (prefixed "Copy of"),
 * icon, color and plaintext. The Y.Doc blob is intentionally NOT copied —
 * the new note starts empty from the editor's perspective; users can copy
 * content inside the editor if they want a true clone.
 */
export async function duplicateNote(id: string) {
  const user = await requireUser();
  const [source] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)))
    .limit(1);
  if (!source) throw new Error('Note not found');

  const [next] = await db
    .select({ position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        source.folderId ? eq(notes.folderId, source.folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(desc(notes.position))
    .limit(1);
  const position = (next?.position ?? 0) + POSITION_STEP;

  const [copy] = await db
    .insert(notes)
    .values({
      ownerId: user.id,
      title: `Copy of ${source.title}`,
      icon: source.icon,
      color: source.color,
      kind: source.kind,
      folderId: source.folderId,
      position,
    })
    .returning();
  revalidatePath('/app');
  return copy;
}

const moveSchema = z.object({
  noteId: z.string(),
  /** Target folder (null = root). */
  folderId: z.string().nullable(),
  /**
   * Desired index among siblings in the target folder (0-based).
   * When omitted the note is appended at the end.
   */
  index: z.number().int().min(0).optional(),
});

/**
 * Move a note to a different folder and/or reorder it within siblings.
 *
 * Computes a new `position` value between the two neighbours at the given
 * index. When the gap collapses to < 1 it re-normalises the folder's
 * positions with POSITION_STEP spacing (rare, keeps the logic simple).
 */
export async function moveNote(input: z.input<typeof moveSchema>) {
  const user = await requireUser();
  const { noteId, folderId, index } = moveSchema.parse(input);

  // Sanity-check the target folder belongs to the user.
  if (folderId) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, user.id)))
      .limit(1);
    if (!folder) throw new Error('Folder not found');
  }

  const siblings = await db
    .select({ id: notes.id, position: notes.position })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, user.id),
        folderId ? eq(notes.folderId, folderId) : isNull(notes.folderId),
      ),
    )
    .orderBy(notes.position);

  // Exclude the dragged note from neighbour calculations (when moving
  // within the same folder).
  const others = siblings.filter((s) => s.id !== noteId);
  const targetIndex = Math.min(index ?? others.length, others.length);
  const before = others[targetIndex - 1]?.position;
  const after = others[targetIndex]?.position;

  let position: number;
  if (before == null && after == null) {
    position = POSITION_STEP;
  } else if (before == null) {
    position = (after as number) - POSITION_STEP;
  } else if (after == null) {
    position = before + POSITION_STEP;
  } else {
    position = (before + after) / 2;
  }

  // If the gap collapsed, renumber the target folder with POSITION_STEP.
  if (after != null && before != null && Math.abs(after - before) < 1) {
    const reordered = [...others];
    reordered.splice(targetIndex, 0, { id: noteId, position: 0 });
    await Promise.all(
      reordered.map((r, i) =>
        db
          .update(notes)
          .set({ position: (i + 1) * POSITION_STEP })
          .where(and(eq(notes.id, r.id), eq(notes.ownerId, user.id))),
      ),
    );
    await db
      .update(notes)
      .set({ folderId: folderId ?? null })
      .where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id)));
  } else {
    await db
      .update(notes)
      .set({ folderId: folderId ?? null, position, updatedAt: new Date() })
      .where(and(eq(notes.id, noteId), eq(notes.ownerId, user.id)));
  }

  revalidatePath('/app');
}

export async function touchNoteOpened(id: string) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ lastOpenedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)));
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, folders, notes, eq, and, asc, desc, isNull } from '@notai/db';

const POSITION_STEP = 1000;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

/** List every folder owned by the caller, in rendering order. */
export async function listFolders() {
  const user = await requireUser();
  return db
    .select()
    .from(folders)
    .where(eq(folders.ownerId, user.id))
    .orderBy(asc(folders.position));
}

/** Fetch a single folder owned by the caller, or null. */
export async function getFolder(id: string) {
  const user = await requireUser();
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)))
    .limit(1);
  return folder ?? null;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).optional().default('New folder'),
  parentId: z.string().nullable().optional(),
});

export async function createFolder(input: z.input<typeof createSchema> = {}) {
  const user = await requireUser();
  const { name, parentId } = createSchema.parse(input);

  // Append at the end of its parent (or root) list.
  const [last] = await db
    .select({ position: folders.position })
    .from(folders)
    .where(
      and(
        eq(folders.ownerId, user.id),
        parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId),
      ),
    )
    .orderBy(desc(folders.position))
    .limit(1);

  const [folder] = await db
    .insert(folders)
    .values({
      ownerId: user.id,
      name,
      parentId: parentId ?? null,
      position: (last?.position ?? 0) + POSITION_STEP,
    })
    .returning();
  revalidatePath('/app');
  return folder;
}

const renameSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80),
});

export async function renameFolder(input: z.input<typeof renameSchema>) {
  const user = await requireUser();
  const { id, name } = renameSchema.parse(input);
  await db
    .update(folders)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)));
  revalidatePath('/app');
}

const setFolderIconSchema = z.object({
  id: z.string(),
  /** Single emoji or short string. `null` clears the icon. */
  icon: z.string().trim().max(8).nullable(),
});

/**
 * Set or clear a folder's icon. We accept a free-form short string so
 * the picker can drop any emoji without a fixed allow-list.
 */
export async function setFolderIcon(input: z.input<typeof setFolderIconSchema>) {
  const user = await requireUser();
  const { id, icon } = setFolderIconSchema.parse(input);
  await db
    .update(folders)
    .set({ icon: icon ?? null, updatedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)));
  revalidatePath('/app');
}

const setDefaultTagsSchema = z.object({
  id: z.string().min(1),
  tagIds: z.array(z.string().min(1)).max(20),
});

/**
 * Replace the folder's default-tag list. Tags are validated via the
 * presence of their ids; ownership of the tags themselves is enforced
 * by the existing tags table queries elsewhere.
 */
export async function setFolderDefaultTags(input: z.input<typeof setDefaultTagsSchema>) {
  const user = await requireUser();
  const { id, tagIds } = setDefaultTagsSchema.parse(input);
  await db
    .update(folders)
    .set({ defaultTagIds: tagIds, updatedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)));
  revalidatePath('/app');
}

/** Read the current default-tag list for a folder. */
export async function getFolderDefaultTags(id: string): Promise<string[]> {
  const user = await requireUser();
  const [row] = await db
    .select({ defaultTagIds: folders.defaultTagIds })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)))
    .limit(1);
  return row?.defaultTagIds ?? [];
}

/**
 * Delete a folder. Child folders cascade (ON DELETE CASCADE) but notes
 * inside cascade to NULL — they survive and move to the root.
 */
export async function deleteFolder(id: string) {
  const user = await requireUser();
  await db.delete(folders).where(and(eq(folders.id, id), eq(folders.ownerId, user.id)));
  revalidatePath('/app');
}

const moveSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  index: z.number().int().min(0).optional(),
});

/** Move/reorder a folder within the sidebar tree. Mirrors `moveNote`. */
export async function moveFolder(input: z.input<typeof moveSchema>) {
  const user = await requireUser();
  const { id, parentId, index } = moveSchema.parse(input);

  if (parentId === id) throw new Error('A folder cannot contain itself');

  // Cycle-check: walk up the proposed parent chain and refuse if we'd
  // make `id` an ancestor of itself.
  if (parentId) {
    let cursor: string | null = parentId;
    for (let i = 0; i < 32 && cursor; i++) {
      if (cursor === id) throw new Error('Cannot move a folder into its own descendant');
      const [p] = await db
        .select({ parentId: folders.parentId })
        .from(folders)
        .where(and(eq(folders.id, cursor), eq(folders.ownerId, user.id)))
        .limit(1);
      if (!p) break;
      cursor = p.parentId;
    }
  }

  const siblings = await db
    .select({ id: folders.id, position: folders.position })
    .from(folders)
    .where(
      and(
        eq(folders.ownerId, user.id),
        parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId),
      ),
    )
    .orderBy(asc(folders.position));

  const others = siblings.filter((s) => s.id !== id);
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

  if (after != null && before != null && Math.abs(after - before) < 1) {
    const reordered = [...others];
    reordered.splice(targetIndex, 0, { id, position: 0 });
    await Promise.all(
      reordered.map((r, i) =>
        db
          .update(folders)
          .set({ position: (i + 1) * POSITION_STEP })
          .where(and(eq(folders.id, r.id), eq(folders.ownerId, user.id))),
      ),
    );
    await db
      .update(folders)
      .set({ parentId: parentId ?? null })
      .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)));
  } else {
    await db
      .update(folders)
      .set({ parentId: parentId ?? null, position, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.ownerId, user.id)));
  }

  revalidatePath('/app');
}

// Ensure all notes belonging to a folder get moved to root when that folder
// is deleted via FK cascade (ON DELETE SET NULL). No extra code needed —
// just exported for discoverability in case we want custom delete behaviour.
export async function countNotesInFolder(id: string) {
  const user = await requireUser();
  const rows = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.ownerId, user.id), eq(notes.folderId, id)));
  return rows.length;
}

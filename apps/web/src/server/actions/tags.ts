'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  tags,
  noteTags,
  notes,
  noteCollaborators,
  eq,
  and,
  or,
  asc,
  inArray,
  sql,
} from '@notai/db';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

async function requireNoteAccess(noteId: string, userId: string) {
  const [row] = await db
    .select({ id: notes.id })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        eq(notes.id, noteId),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Note not found');
}

/** Returns the user's tags (alphabetical) with usage counts. */
export async function listTags() {
  const me = await requireUser();
  return db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      count: sql<number>`COUNT(${noteTags.noteId})`.as('count'),
    })
    .from(tags)
    .leftJoin(noteTags, eq(noteTags.tagId, tags.id))
    .where(eq(tags.ownerId, me.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
}

const upsertSchema = z.object({
  noteId: z.string().min(1),
  name: z
    .string()
    .min(1)
    .max(40)
    .transform((s) => s.trim().toLowerCase().replace(/\s+/g, '-')),
  color: z.string().max(30).optional(),
});

/**
 * Attach a tag to a note by name. Creates the tag if it doesn't exist —
 * lets the chip input feel like Twitter / Notion.
 */
export async function attachTag(input: z.input<typeof upsertSchema>) {
  const me = await requireUser();
  const { noteId, name, color } = upsertSchema.parse(input);
  await requireNoteAccess(noteId, me.id);

  const [tag] = await db
    .insert(tags)
    .values({ ownerId: me.id, name, color: color ?? 'default' })
    .onConflictDoUpdate({
      target: [tags.ownerId, tags.name],
      set: { name },
    })
    .returning();
  if (!tag) throw new Error('Could not create tag');

  await db.insert(noteTags).values({ noteId, tagId: tag.id }).onConflictDoNothing();
  revalidatePath(`/app/n/${noteId}`);
  return tag;
}

export async function detachTag(input: { noteId: string; tagId: string }) {
  const me = await requireUser();
  await requireNoteAccess(input.noteId, me.id);
  await db
    .delete(noteTags)
    .where(and(eq(noteTags.noteId, input.noteId), eq(noteTags.tagId, input.tagId)));
  revalidatePath(`/app/n/${input.noteId}`);
}

/** Tags currently on a note (joined with the user's tag table). */
export async function listNoteTags(noteId: string) {
  const me = await requireUser();
  await requireNoteAccess(noteId, me.id);
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(noteTags)
    .innerJoin(tags, eq(tags.id, noteTags.tagId))
    .where(and(eq(noteTags.noteId, noteId), eq(tags.ownerId, me.id)));
  return rows;
}

/** Notes that carry the given tag (used by the sidebar filter view). */
export async function listNotesByTag(tagId: string) {
  const me = await requireUser();
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .innerJoin(noteTags, eq(noteTags.noteId, notes.id))
    .where(and(eq(notes.ownerId, me.id), eq(noteTags.tagId, tagId)))
    .orderBy(notes.updatedAt);
  return rows;
}

/** Renames or recolors a tag. */
export async function updateTag(input: { id: string; name?: string; color?: string }) {
  const me = await requireUser();
  await db
    .update(tags)
    .set({
      ...(input.name ? { name: input.name.trim().toLowerCase().replace(/\s+/g, '-') } : {}),
      ...(input.color ? { color: input.color } : {}),
    })
    .where(and(eq(tags.id, input.id), eq(tags.ownerId, me.id)));
  revalidatePath('/app');
}

export async function deleteTag(id: string) {
  const me = await requireUser();
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.ownerId, me.id)));
  revalidatePath('/app');
}

void inArray; // re-exported for future bulk ops

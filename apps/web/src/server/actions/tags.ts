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

/**
 * Same shape as `listNotesByTag` but keyed by tag name. Used by the
 * `/app/tags/[name]` page so the URL can stay human-readable.
 * Returns the tag row alongside the notes (or null if the tag
 * doesn't exist for the user).
 */
export async function listNotesByTagName(name: string) {
  const me = await requireUser();
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, '-');
  if (!cleaned)
    return {
      tag: null,
      notes: [] as Array<{
        id: string;
        title: string | null;
        icon: string | null;
        updatedAt: Date;
      }>,
    };
  const [tag] = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(and(eq(tags.ownerId, me.id), eq(tags.name, cleaned)))
    .limit(1);
  if (!tag) return { tag: null, notes: [] };
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .innerJoin(noteTags, eq(noteTags.noteId, notes.id))
    .where(and(eq(notes.ownerId, me.id), eq(noteTags.tagId, tag.id)))
    .orderBy(notes.updatedAt);
  return { tag, notes: rows };
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

/**
 * Ask the user's AI provider for 1-3 short, lowercase tag suggestions
 * based on a note's plaintext. Returns existing tags (so the user can
 * "accept" without creating duplicates) and brand-new ones.
 *
 * Cheap-but-not-free: runs streamChat once and parses a single JSON
 * line. We trim aggressively so a chatty model can't blow up our chip
 * row.
 */
export async function suggestTagsForNote(noteId: string): Promise<string[]> {
  const me = await requireUser();
  await requireNoteAccess(noteId, me.id);

  const [row] = await db
    .select({ title: notes.title, plaintext: notes.plaintext })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!row) return [];

  const corpus = `${row.title ?? ''}\n\n${(row.plaintext ?? '').slice(0, 4000)}`.trim();
  if (corpus.length < 12) return [];

  const { streamChat } = await import('@/server/openai');
  const { requireQuota, incrementAiUsage } = await import('@/server/plans');
  await requireQuota(me.id, 'ai');

  const stream = await streamChat({
    system: `You suggest tags for personal notes. Output STRICT JSON: {"tags": ["tag-one", ...]}.
- 1 to 3 tags, each 1-3 words, lowercase, hyphen-separated, no '#' prefix.
- Prefer concrete topics over generic ones (avoid "notes", "thoughts", "misc").
- Skip if the note is too short or empty — return {"tags": []}.`,
    user: corpus,
    temperature: 0.2,
    userId: me.id,
  });
  let out = '';
  for await (const delta of stream) out += delta;
  await incrementAiUsage(me.id, 1);

  // Tolerate code fences and chatty prefixes.
  const match = out.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { tags?: unknown };
    if (!Array.isArray(parsed.tags)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of parsed.tags) {
      if (typeof raw !== 'string') continue;
      const t = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      cleaned.push(t);
      if (cleaned.length >= 3) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

void inArray; // re-exported for future bulk ops

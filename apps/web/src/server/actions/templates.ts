'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, templates, notes, eq, asc, or, and, sql } from '@notai/db';

export interface TemplateSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string | null;
  isOfficial: boolean;
  uses: number;
  isPersonal?: boolean;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const rows = await db
    .select({
      id: templates.id,
      slug: templates.slug,
      title: templates.title,
      description: templates.description,
      category: templates.category,
      icon: templates.icon,
      isOfficial: templates.isOfficial,
      isPublished: templates.isPublished,
      authorId: templates.authorId,
      uses: templates.uses,
    })
    .from(templates)
    .where(
      userId
        ? or(eq(templates.isPublished, true), eq(templates.authorId, userId))
        : eq(templates.isPublished, true),
    )
    .orderBy(asc(templates.category), asc(templates.title));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    category: r.category,
    icon: r.icon,
    isOfficial: r.isOfficial,
    uses: r.uses,
    isPersonal: !r.isPublished && r.authorId === userId,
  }));
}

const personalSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(280).optional().default(''),
});

/** Save the current note as a personal (unpublished) template. */
export async function createPersonalTemplate(input: {
  noteId: string;
  title: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated');
  const me = session.user as { id: string };
  const { noteId, title, description } = personalSchema.parse(input);

  const [note] = await db
    .select({ ownerId: notes.ownerId, plaintext: notes.plaintext, icon: notes.icon })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!note || note.ownerId !== me.id) throw new Error('Note not found');

  const slug = `user-${me.id.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .insert(templates)
    .values({
      slug,
      title,
      description: description ?? '',
      category: 'personal',
      icon: note.icon ?? '📄',
      tags: [],
      body: { kind: 'note', plaintext: note.plaintext ?? '' },
      authorId: me.id,
      isOfficial: false,
      isPublished: false,
    })
    .returning({ id: templates.id, slug: templates.slug });
  return row;
}

const deletePersonalSchema = z.object({ slug: z.string().min(1) });

/** Delete a personal template — only the author can. */
export async function deletePersonalTemplate(input: { slug: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated');
  const me = session.user as { id: string };
  const { slug } = deletePersonalSchema.parse(input);
  await db
    .delete(templates)
    .where(
      and(
        eq(templates.slug, slug),
        eq(templates.authorId, me.id),
        eq(templates.isPublished, false),
      ),
    );
}

const applySchema = z.object({ slug: z.string().min(1) });

/**
 * Apply a template — creates a fresh note for the user pre-filled with
 * the template's body, bumps the use counter, and redirects.
 */
export async function applyTemplate(input: { slug: string } | FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/templates');
  const me = session.user as { id: string };
  const slugRaw = input instanceof FormData ? String(input.get('slug') ?? '') : input.slug;
  const { slug } = applySchema.parse({ slug: slugRaw });

  const [tpl] = await db.select().from(templates).where(eq(templates.slug, slug)).limit(1);
  if (!tpl) throw new Error('Template not found');

  const body = tpl.body as { plaintext?: string };
  const [note] = await db
    .insert(notes)
    .values({
      ownerId: me.id,
      title: tpl.title,
      icon: tpl.icon ?? '📄',
      kind: 'note',
      plaintext: body.plaintext ?? '',
    })
    .returning({ id: notes.id });

  await db
    .update(templates)
    .set({ uses: sql`${templates.uses} + 1` })
    .where(eq(templates.id, tpl.id));

  if (!note) throw new Error('Failed to create note');
  redirect(`/app/n/${note.id}`);
}

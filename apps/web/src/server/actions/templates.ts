'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, templates, notes, eq, asc, sql } from '@notai/db';

export interface TemplateSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string | null;
  isOfficial: boolean;
  uses: number;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  return db
    .select({
      id: templates.id,
      slug: templates.slug,
      title: templates.title,
      description: templates.description,
      category: templates.category,
      icon: templates.icon,
      isOfficial: templates.isOfficial,
      uses: templates.uses,
    })
    .from(templates)
    .where(eq(templates.isPublished, true))
    .orderBy(asc(templates.category), asc(templates.title));
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
  const slugRaw =
    input instanceof FormData ? String(input.get('slug') ?? '') : input.slug;
  const { slug } = applySchema.parse({ slug: slugRaw });

  const [tpl] = await db
    .select()
    .from(templates)
    .where(eq(templates.slug, slug))
    .limit(1);
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

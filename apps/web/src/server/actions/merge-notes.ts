'use server';

/**
 * Merge a source note into a target note. The source's plaintext is
 * appended to the target via a `notai:pending-append` localStorage
 * handoff (the workspace already drains this on mount), and the source
 * is then soft-deleted (`deletedAt`).
 *
 * We keep this simple: no paragraph dedup, no AI rewrite. The user can
 * tidy the merged note manually.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, notes, eq, and } from '@notai/db';

const inputSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
});

export interface MergeResult {
  appendText: string;
  targetId: string;
  sourceTitle: string;
}

export async function mergeNotes(input: z.input<typeof inputSchema>): Promise<MergeResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sign in required');

  const { sourceId, targetId } = inputSchema.parse(input);
  if (sourceId === targetId) throw new Error('Source and target must be different notes');

  const [source] = await db
    .select({ id: notes.id, title: notes.title, plaintext: notes.plaintext })
    .from(notes)
    .where(and(eq(notes.id, sourceId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!source) throw new Error('Source note not found');

  const [target] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, targetId), eq(notes.ownerId, userId)))
    .limit(1);
  if (!target) throw new Error('Target note not found');

  const appendText = `\n\n--- Merged from "${source.title || 'Untitled'}" ---\n\n${source.plaintext ?? ''}`;

  await db
    .update(notes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.id, sourceId), eq(notes.ownerId, userId)));

  revalidatePath('/app');
  revalidatePath(`/app/n/${targetId}`);

  return {
    appendText,
    targetId,
    sourceTitle: source.title || 'Untitled',
  };
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { requireQuota } from '@/server/plans';
import { apiCreateNote } from '@/server/notes-api';

const inputSchema = z.object({
  text: z.string().min(1).max(20000),
});

/**
 * Lightweight server action behind the in-app Quick Capture overlay
 * (FAB bubble + ⌘. hotkey). Creates a sticky-kind note with the first
 * non-empty line as the title and the full body as plaintext. The
 * editor's Y.Doc starts empty — same pattern as the web clipper —
 * so the captured text is searchable and visible in the preview list,
 * and the user can promote it into a full canvas note when they open it.
 */
export async function quickCapture(input: z.input<typeof inputSchema>): Promise<{
  id: string;
  title: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { text } = inputSchema.parse(input);
  await requireQuota(session.user.id, 'notes');

  const trimmed = text.trim();
  const firstLine = (trimmed.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '').trim();
  const title = firstLine.length > 0 ? firstLine.slice(0, 80) : 'Quick capture';

  const note = await apiCreateNote(session.user.id, {
    title,
    icon: '⚡',
    kind: 'sticky',
    plaintext: trimmed,
  });
  if (!note) throw new Error('Failed to create note');

  revalidatePath('/app');
  return { id: note.id, title: note.title ?? title };
}

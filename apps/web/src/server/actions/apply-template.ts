'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, templates, notes, noteCollaborators, eq, and, or, sql } from '@notai/db';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

const inputSchema = z.object({
  noteId: z.string().min(1),
  slug: z.string().min(1),
  mode: z.enum(['blank', 'ai-fill']),
});

export interface ApplyTemplateResult {
  markdown: string;
  templateTitle: string;
}

const SYSTEM = [
  "You are filling a structured note template using the user's own existing content.",
  'Rules:',
  '1. Preserve the template structure (every heading and bullet) exactly.',
  '2. Under each section, place ONLY content that is genuinely supported by the existing note. Quote phrases verbatim where natural.',
  '3. If a section has no evidence in the existing content, leave its placeholder empty (the original `- ` or empty line) so the user can fill it in. Do NOT invent.',
  '4. Output Markdown only. No preamble, no explanation, no fences.',
].join('\n');

async function requireNoteAccess(noteId: string, userId: string) {
  const [row] = await db
    .select({ id: notes.id, plaintext: notes.plaintext, title: notes.title })
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
  return row;
}

export async function applyTemplateToNote(
  input: z.infer<typeof inputSchema>,
): Promise<ApplyTemplateResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('Not signed in');

  const parsed = inputSchema.parse(input);
  const note = await requireNoteAccess(parsed.noteId, userId);

  const [tpl] = await db
    .select({ id: templates.id, title: templates.title, body: templates.body })
    .from(templates)
    .where(eq(templates.slug, parsed.slug))
    .limit(1);
  if (!tpl) throw new Error('Template not found');

  const body = tpl.body as { plaintext?: string };
  const skeleton = (body.plaintext ?? '').trim();
  if (!skeleton) throw new Error('Template body is empty');

  await db
    .update(templates)
    .set({ uses: sql`${templates.uses} + 1` })
    .where(eq(templates.id, tpl.id));

  if (parsed.mode === 'blank') {
    return { markdown: skeleton, templateTitle: tpl.title };
  }

  // AI fill: use the user's existing note content as evidence.
  await requireQuota(userId, 'ai');
  const existing = (note.plaintext ?? '').trim().slice(0, 12_000);
  if (!existing) {
    // Nothing to map from — fall back to the blank skeleton rather than
    // burning AI quota on an empty prompt.
    return { markdown: skeleton, templateTitle: tpl.title };
  }

  const user = [
    `Template (must keep this structure exactly):\n\n${skeleton}`,
    '',
    `Existing note content (titled "${note.title || 'Untitled'}"):\n\n${existing}`,
    '',
    'Fill the template above using only what is in the existing content. Leave empty placeholders where you have no evidence.',
  ].join('\n');

  let result = '';
  for await (const delta of streamChat({
    system: SYSTEM,
    user,
    temperature: 0.2,
    userId,
  })) {
    result += delta;
  }
  await incrementAiUsage(userId, 1);

  return {
    markdown: result.trim() || skeleton,
    templateTitle: tpl.title,
  };
}

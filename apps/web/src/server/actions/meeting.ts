'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

/**
 * Granola-style meeting enhancement. Takes the user's raw notes (read
 * from the note's plaintext) plus a freshly captured transcript, and
 * returns a structured Markdown summary: TL;DR, decisions, action
 * items, open questions. The output is meant to be inserted at the
 * bottom of the note, not to replace anything the user wrote.
 */
const inputSchema = z.object({
  noteId: z.string().min(1),
  transcript: z.string().min(20).max(120_000),
  rawNotes: z.string().max(60_000).optional(),
  language: z.string().max(20).optional(),
});

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

export interface EnhancedMeeting {
  markdown: string;
}

export async function enhanceMeetingNotes(
  input: z.infer<typeof inputSchema>,
): Promise<EnhancedMeeting> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('Not signed in');

  const parsed = inputSchema.parse(input);
  await requireQuota(userId, 'ai');

  const note = await requireNoteAccess(parsed.noteId, userId);
  const raw = (parsed.rawNotes ?? note.plaintext ?? '').slice(0, 60_000);
  const transcript = parsed.transcript.slice(0, 120_000);
  const lang = parsed.language?.trim() || 'the same language as the transcript';

  const system = [
    'You are a meeting-notes assistant in the Granola style.',
    'You receive: (1) raw notes the user typed during the meeting and',
    '(2) a transcript captured from their device microphone and tab audio.',
    'Your job is to MERGE them into one polished, faithful set of notes.',
    'Preserve every fact the user wrote. Do not invent details.',
    'If something in the transcript contradicts the raw notes, prefer the',
    "user's notes and add a one-line 'Clarify:' bullet under Open Questions.",
    'Output strict Markdown only — no preamble, no closing remark.',
  ].join(' ');

  const user = [
    `Write the enhanced notes in ${lang}. Use this exact structure:`,
    '',
    '## TL;DR',
    '_3–5 sentences max._',
    '',
    '## Decisions',
    '- bullet per decision (omit the section if there are none)',
    '',
    '## Action items',
    '- [ ] Owner — what — by when (omit if none)',
    '',
    '## Notes',
    '_The user’s raw notes, lightly cleaned up, expanded with detail from the transcript where it actually adds something. Keep their original wording when possible._',
    '',
    '## Open questions',
    '- bullet per unresolved thread (omit if none)',
    '',
    '---',
    `# Note title: ${note.title}`,
    '',
    '## Raw notes the user typed',
    raw || '(none — the user did not type any notes during the call)',
    '',
    '## Transcript',
    transcript,
  ].join('\n');

  let result = '';
  for await (const delta of streamChat({ system, user, temperature: 0.2, userId })) {
    result += delta;
  }
  await incrementAiUsage(userId, 1);
  return { markdown: result.trim() };
}

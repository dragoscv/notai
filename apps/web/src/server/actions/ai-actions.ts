'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

async function requireUserAccess(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const me = session.user as { id: string };
  const [row] = await db
    .select({ id: notes.id, plaintext: notes.plaintext, title: notes.title })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, me.id)),
    )
    .where(
      and(eq(notes.id, noteId), or(eq(notes.ownerId, me.id), eq(noteCollaborators.userId, me.id))),
    )
    .limit(1);
  if (!row) throw new Error('Note not found');
  return row;
}

const idSchema = z.string().min(1);

async function runPrompt(noteId: string, system: string, prefix: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!userId) throw new Error('Not signed in');
  await requireQuota(userId, 'ai');
  const note = await requireUserAccess(idSchema.parse(noteId));
  const text = `${note.title}\n\n${(note.plaintext ?? '').slice(0, 8000)}`;
  let result = '';
  for await (const delta of streamChat({
    system,
    user: `${prefix}\n\n---\n${text}`,
    temperature: 0.2,
    userId,
  })) {
    result += delta;
  }
  await incrementAiUsage(userId, 1);
  return result.trim();
}

export async function summarizeNote(noteId: string) {
  return runPrompt(
    noteId,
    'You are an editor that produces tight summaries with no fluff.',
    'Summarize this note in 3–5 bullet points. Plain Markdown only.',
  );
}

export async function extractActionItems(noteId: string) {
  return runPrompt(
    noteId,
    'You extract concrete next-actions from notes. Output a Markdown checklist.',
    'List the action items / next steps from this note as `- [ ]` items. ' +
      'If there are none, say "No action items found."',
  );
}

export async function rewriteForClarity(noteId: string) {
  return runPrompt(
    noteId,
    'You rewrite messy notes into clean, well-structured Markdown without changing meaning.',
    'Rewrite this note for clarity. Keep all facts, fix grammar, add headings if helpful.',
  );
}

export async function generateOutline(noteId: string) {
  return runPrompt(
    noteId,
    'You produce structured outlines from notes. Output a Markdown nested list ' +
      '(2 levels max), no preamble, no headings.',
    'Outline this note as a nested bullet list. Top-level = major themes, sub-bullets = supporting points.',
  );
}

export async function suggestTitle(noteId: string) {
  return runPrompt(
    noteId,
    'You write tight, descriptive titles. Output exactly ONE title \u2014 no quotes, no Markdown, ' +
      'no preamble, no alternatives. 3\u20138 words, Title Case, no trailing punctuation.',
    'Suggest a title for this note.',
  );
}

export async function fixSpelling(noteId: string) {
  return runPrompt(
    noteId,
    'You fix spelling and grammar mistakes ONLY. Do not rewrite, restructure, or change ' +
      'wording, tone, or meaning. Preserve every Markdown structure exactly.',
    'Return the note with spelling and grammar fixed. Output the corrected text only.',
  );
}

const continueSchema = z.object({
  noteId: z.string().min(1),
  prefix: z.string().min(1).max(4000),
});

/**
 * "Continue this thought" \u2014 takes a snippet from the canvas and asks
 * the model to extend it by 1-3 sentences in the same voice. Used by
 * the inline "continue writing" button on a selected text element.
 */
export async function continueWriting(input: { noteId: string; prefix: string }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!userId) throw new Error('Not signed in');
  await requireQuota(userId, 'ai');
  const { noteId, prefix } = continueSchema.parse(input);
  await requireUserAccess(idSchema.parse(noteId));
  let result = '';
  for await (const delta of streamChat({
    system:
      "You continue someone's in-progress writing. Match their tone, voice, and " +
      'level of formality. Add 1-3 sentences only. No commentary, no quotes, no ' +
      'meta. Continue directly from where they stopped.',
    user: prefix,
    temperature: 0.6,
    userId,
  })) {
    result += delta;
  }
  await incrementAiUsage(userId, 1);
  return result.trim();
}

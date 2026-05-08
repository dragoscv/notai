'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { streamChat } from '@/server/openai';

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

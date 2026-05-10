'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    label: z.string().min(1).max(140),
    children: z.array(MindMapNodeSchema).max(8).optional(),
  }),
);

export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export interface MindMap {
  root: MindMapNode;
}

const MindMapSchema = z.object({ root: MindMapNodeSchema });

const SYSTEM = `You convert notes into a hierarchical mind map.

Rules:
- Output STRICT JSON matching this TypeScript type:
  type MindMap = { root: { label: string; children?: MindMap['root'][] } };
- The root label is the central topic (3-6 words).
- Up to 7 first-level branches; each may have up to 5 sub-branches; max depth 3.
- Labels are concise (under 60 chars). No Markdown, no leading dashes, no bullets, no quotes.
- Output ONLY the JSON object. No prose, no code fences.`;

const PROMPT = `Create a mind map of the following note. Identify the central topic, the major themes (first-level branches), and the supporting facts (sub-branches). Drop trivia. Return JSON only.`;

async function loadNote(noteId: string, userId: string) {
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

function stripFences(s: string): string {
  const trimmed = s.trim();
  // Strip ```json ... ``` or ``` ... ``` if the model ignored instructions.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export async function generateMindMap(noteIdRaw: string): Promise<MindMap> {
  const noteId = z.string().min(1).parse(noteIdRaw);
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!userId) throw new Error('Not signed in');
  await requireQuota(userId, 'ai');

  const note = await loadNote(noteId, userId);
  const corpus = `${note.title}\n\n${(note.plaintext ?? '').slice(0, 12000)}`.trim();
  if (corpus.length < 8) throw new Error('Note is empty.');

  let raw = '';
  for await (const delta of streamChat({
    system: SYSTEM,
    user: `${PROMPT}\n\n---\n${corpus}`,
    temperature: 0.2,
    userId,
  })) {
    raw += delta;
  }
  await incrementAiUsage(userId, 1);

  const stripped = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error('AI returned invalid JSON.');
  }
  const result = MindMapSchema.safeParse(parsed);
  if (!result.success) throw new Error('AI returned an unexpected structure.');
  return result.data;
}

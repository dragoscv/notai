'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull, sql } from '@notai/db';
import { embedText, streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

export interface AskHit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  score: number;
}

const querySchema = z.object({
  question: z.string().min(2).max(2000),
  topK: z.number().int().min(1).max(12).default(6),
});

/** Vector search → top-K notes related to the question. */
export async function askMyNotesSearch(input: z.input<typeof querySchema>): Promise<AskHit[]> {
  const me = await requireUser();
  const { question, topK } = querySchema.parse(input);
  const embed = await embedText(question, me.id);
  if (!embed) return [];

  // pgvector cosine distance operator: `<=>`. Lower = closer.
  const literal = `[${embed.embedding.join(',')}]`;
  const distance = sql<number>`${notes.embedding} <=> ${literal}::vector`;
  const rows = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      score: distance,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, me.id)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        sql`${notes.embedding} IS NOT NULL`,
        or(eq(notes.ownerId, me.id), eq(noteCollaborators.userId, me.id)),
      ),
    )
    .orderBy(distance)
    .limit(topK);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon,
    snippet: snippet(r.plaintext, question),
    score: 1 - Number(r.score), // turn cosine distance into similarity-ish
  }));
}

function snippet(text: string | null, q: string) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ');
  const i = t.toLowerCase().indexOf(q.toLowerCase().split(/\s+/)[0] ?? '');
  if (i === -1) return t.slice(0, 200);
  const start = Math.max(0, i - 80);
  return (start > 0 ? '…' : '') + t.slice(start, start + 240);
}

/**
 * Streaming "Ask my notes" — the React component consumes the returned
 * `ReadableStream` via Server Actions' streaming hook (`use(...)` or
 * `useFormState`). Citations are baked into the prompt as `[#1] …`.
 */
export async function askMyNotesStream(input: { question: string }) {
  const me = await requireUser();
  await requireQuota(me.id, 'ai');
  const hits = await askMyNotesSearch({ question: input.question, topK: 6 });
  const context = hits.map((h, i) => `[#${i + 1}] ${h.title}\n${h.snippet}`).join('\n\n');
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(JSON.stringify({ type: 'hits', hits }) + '\n'));
      const system =
        "You are Notai, a friendly assistant for the user's personal notes. " +
        'Answer using only the context provided; cite sources with [#n] where relevant. ' +
        "If the context doesn't contain the answer, say so honestly.";
      const user = `Context:\n${context || '(no relevant notes found)'}\n\nQuestion: ${input.question}`;
      try {
        for await (const chunk of streamChat({ system, user, userId: me.id })) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', text: chunk }) + '\n'));
        }
        await incrementAiUsage(me.id, 1);
      } catch (err) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'error', message: String(err) }) + '\n'),
        );
      } finally {
        controller.close();
      }
    },
  });
  return stream;
}

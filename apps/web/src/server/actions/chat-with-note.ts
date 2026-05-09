'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, noteChatMessages, eq, and, or, asc } from '@notai/db';
import { askMyNotesSearch } from '@/server/actions/ask';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

/** Owner OR collaborator gets read access to a note. */
async function loadNoteForUser(userId: string, noteId: string) {
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
    })
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
  return row ?? null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Array<{ label: string; noteId: string; title: string }> | null;
  createdAt: string;
}

export async function listChatMessages(noteId: string): Promise<ChatMessage[]> {
  const me = await requireUser();
  // Implicit access check: messages are scoped to (noteId, userId), so listing
  // by user can't leak across users. We still gate by note access to avoid
  // returning history for notes the user lost access to.
  const note = await loadNoteForUser(me.id, noteId);
  if (!note) return [];
  const rows = await db
    .select({
      id: noteChatMessages.id,
      role: noteChatMessages.role,
      content: noteChatMessages.content,
      citations: noteChatMessages.citations,
      createdAt: noteChatMessages.createdAt,
    })
    .from(noteChatMessages)
    .where(and(eq(noteChatMessages.noteId, noteId), eq(noteChatMessages.userId, me.id)))
    .orderBy(asc(noteChatMessages.createdAt));
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    citations: r.citations,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function clearChat(noteId: string): Promise<void> {
  const me = await requireUser();
  const note = await loadNoteForUser(me.id, noteId);
  if (!note) throw new Error('Not found');
  await db
    .delete(noteChatMessages)
    .where(and(eq(noteChatMessages.noteId, noteId), eq(noteChatMessages.userId, me.id)));
}

const askSchema = z.object({
  noteId: z.string().min(1),
  question: z.string().min(1).max(4000),
});

interface Citation {
  label: string;
  noteId: string;
  title: string;
}

/**
 * Streams an assistant turn over NDJSON. Lines:
 *   {type:'citations', items: Citation[]}
 *   {type:'delta', text: string}
 *   {type:'message', userId: string, assistantId: string}
 *   {type:'error', message: string}
 *   {type:'done'}
 *
 * Persists both the user and assistant rows: user before streaming,
 * assistant on `done`. Errors don't reject — they're encoded inline.
 */
export async function streamChatTurn(raw: unknown): Promise<ReadableStream<Uint8Array>> {
  const me = await requireUser();
  const { noteId, question } = askSchema.parse(raw);
  const note = await loadNoteForUser(me.id, noteId);
  if (!note) throw new Error('Not found');

  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));

      // Persist the user message first so the UI can render it from history
      // on reload even if the stream is interrupted.
      const [userRow] = await db
        .insert(noteChatMessages)
        .values({
          noteId,
          userId: me.id,
          role: 'user',
          content: question,
          citations: null,
        })
        .returning({ id: noteChatMessages.id });

      try {
        await requireQuota(me.id, 'ai');

        // Build retrieval: current note (always) + top vector hits across
        // the user's other notes. Cite as [#current] and [#1..N].
        const otherHits = await askMyNotesSearch({
          question,
          topK: 5,
        }).catch(() => []);
        const filtered = otherHits.filter((h) => h.id !== noteId).slice(0, 3);

        const citations: Citation[] = [
          { label: '#current', noteId, title: note.title || 'this note' },
          ...filtered.map((h, i) => ({
            label: `#${i + 1}`,
            noteId: h.id,
            title: h.title || 'Untitled',
          })),
        ];
        send({ type: 'citations', items: citations });

        const currentBlock = `[#current] ${note.title || 'Untitled'}\n${(note.plaintext || '').slice(0, 6000)}`;
        const otherBlock = filtered
          .map((h, i) => `[#${i + 1}] ${h.title}\n${h.snippet}`)
          .join('\n\n');

        // Load recent prior turns (last 12) for short conversational memory.
        // Older context isn't worth the tokens; users can clear if they
        // want a fresh start.
        const prior = await db
          .select({
            role: noteChatMessages.role,
            content: noteChatMessages.content,
          })
          .from(noteChatMessages)
          .where(and(eq(noteChatMessages.noteId, noteId), eq(noteChatMessages.userId, me.id)))
          .orderBy(asc(noteChatMessages.createdAt));
        const recent = prior.slice(Math.max(0, prior.length - 13), prior.length - 1);
        const transcript = recent
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');

        const system =
          'You are Notai, an inline notes assistant. Answer using ONLY the provided ' +
          'context. Always prefer information from [#current] (the note the user is ' +
          'looking at). Cite sources inline as [#current] or [#1] when you use them. ' +
          "If the answer isn't in the context, say so. Be concise and use Markdown.";
        const userPrompt =
          `${transcript ? `Conversation so far:\n${transcript}\n\n` : ''}` +
          `Context:\n${currentBlock}\n\n${otherBlock || ''}\n\n` +
          `Question: ${question}`;

        let answer = '';
        for await (const chunk of streamChat({
          system,
          user: userPrompt,
          temperature: 0.3,
          userId: me.id,
        })) {
          if (!chunk) continue;
          answer += chunk;
          send({ type: 'delta', text: chunk });
        }

        const [assistantRow] = await db
          .insert(noteChatMessages)
          .values({
            noteId,
            userId: me.id,
            role: 'assistant',
            content: answer,
            citations,
          })
          .returning({ id: noteChatMessages.id });
        await incrementAiUsage(me.id, 1);

        send({
          type: 'message',
          userId: userRow?.id ?? null,
          assistantId: assistantRow?.id ?? null,
        });
        send({ type: 'done' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });
}

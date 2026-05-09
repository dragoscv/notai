import 'server-only';
import { z } from 'zod';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

/**
 * Inline-AI commands invoked from the slash menu of a text block. Distinct
 * from "Ask my notes" (whole-workspace) and from `ai-actions.ts` (whole-note
 * helpers shown in the right panel). Each call streams plain text/markdown
 * deltas back to the caller, who appends them at the cursor.
 */

export const SLASH_AI_ACTIONS = [
  'write',
  'continue',
  'expand',
  'summarize',
  'rewrite',
  'action-items',
  'improve',
  'translate',
] as const;

export type SlashAiAction = (typeof SLASH_AI_ACTIONS)[number];

const REWRITE_TONES = ['concise', 'formal', 'friendly', 'bullets', 'professional'] as const;

export const slashAiRequestSchema = z.object({
  action: z.enum(SLASH_AI_ACTIONS),
  prompt: z.string().max(2000).optional(),
  tone: z.string().max(40).optional(),
  lang: z.string().max(40).optional(),
  selection: z.string().max(8000).optional(),
  blockText: z.string().max(8000).optional(),
  noteId: z.string().min(1).optional(),
});

export type SlashAiRequest = z.infer<typeof slashAiRequestSchema>;

interface BuiltPrompt {
  system: string;
  user: string;
  temperature: number;
}

function buildPrompt(req: SlashAiRequest, noteContext: string): BuiltPrompt {
  const { action } = req;
  const subject = req.selection?.trim() || req.blockText?.trim() || '';
  const ctxBlock = noteContext
    ? `\n\nNote context (for reference, do not repeat verbatim):\n${noteContext.slice(0, 4000)}`
    : '';

  switch (action) {
    case 'write': {
      const prompt = (req.prompt ?? '').trim() || 'Write something useful here.';
      return {
        system:
          'You are an inline writing assistant inside a notes app. Produce clean Markdown ' +
          'with no preamble, no apologies, no "Here is…". Match the surrounding tone if shown.',
        user: `Task: ${prompt}${ctxBlock}\n\nWrite the content now (Markdown only):`,
        temperature: 0.6,
      };
    }
    case 'continue': {
      const text = subject || noteContext.slice(-1000);
      return {
        system:
          "You continue the user's writing in their voice. No preamble; output only the " +
          'continuation text in Markdown. Stop after 1–3 sentences unless the user clearly ' +
          'started a list or longer structure.',
        user: `Continue this text seamlessly:\n\n${text}`,
        temperature: 0.55,
      };
    }
    case 'expand': {
      return {
        system:
          'You expand terse notes (bullets, fragments) into clear, well-structured Markdown ' +
          'prose. Preserve every fact; never invent new ones. No preamble.',
        user: `Expand this into prose:\n\n${subject || '(use the note context below)'}${ctxBlock}`,
        temperature: 0.4,
      };
    }
    case 'summarize': {
      return {
        system:
          'You produce tight summaries with no fluff. Output a Markdown bulleted list ' +
          '(3–5 bullets) covering the key points only. No preamble.',
        user: `Summarize:\n\n${subject || noteContext.slice(0, 6000)}`,
        temperature: 0.2,
      };
    }
    case 'rewrite': {
      const toneRaw = (req.tone ?? 'concise').trim().toLowerCase();
      const tone =
        (REWRITE_TONES as readonly string[]).includes(toneRaw) || toneRaw.length <= 40
          ? toneRaw
          : 'concise';
      return {
        system:
          'You rewrite text in the requested tone without changing meaning or facts. ' +
          'Output Markdown only, no preamble.',
        user:
          `Rewrite the following in a ${tone} tone. Keep all facts:\n\n` +
          `${subject || '(use the note context below)'}${ctxBlock}`,
        temperature: 0.4,
      };
    }
    case 'action-items': {
      return {
        system:
          'You extract concrete next-actions from notes. Output a Markdown checklist using ' +
          '`- [ ] item` syntax. If nothing is actionable, output exactly: ' +
          '`- [ ] No action items found.`',
        user: `Find the action items in:\n\n${subject || noteContext.slice(0, 6000)}`,
        temperature: 0.2,
      };
    }
    case 'improve': {
      return {
        system:
          'You polish writing: fix grammar, tighten phrasing, improve clarity. Preserve ' +
          'meaning, voice, and Markdown structure. Output the improved Markdown directly, ' +
          'no preamble or commentary.',
        user: `Improve this:\n\n${subject || '(use the note context below)'}${ctxBlock}`,
        temperature: 0.3,
      };
    }
    case 'translate': {
      const lang = (req.lang ?? 'English').trim() || 'English';
      return {
        system:
          'You translate text accurately while preserving Markdown structure (headings, ' +
          'lists, code blocks, links). Output only the translation, no commentary.',
        user: `Translate to ${lang}:\n\n${subject || '(use the note context below)'}${ctxBlock}`,
        temperature: 0.2,
      };
    }
  }
}

async function loadNoteContext(userId: string, noteId: string | undefined): Promise<string> {
  if (!noteId) return '';
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
  if (!row) return '';
  return `${row.title ?? ''}\n\n${row.plaintext ?? ''}`.trim();
}

/**
 * Returns an NDJSON `ReadableStream`. Lines are JSON objects:
 *   {type: 'delta', text: '...'} - partial output
 *   {type: 'done'}                - end-of-stream
 *   {type: 'error', message: ...} - terminal error (quota, no provider, etc.)
 *
 * Errors don't reject — they're encoded into the stream so the client can
 * keep its UI consistent and show the message inline.
 */
export async function streamSlashAi(
  raw: unknown,
  userId: string,
): Promise<ReadableStream<Uint8Array>> {
  const parsed = slashAiRequestSchema.parse(raw);
  const ctx = await loadNoteContext(userId, parsed.noteId);

  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      try {
        await requireQuota(userId, 'ai');
        const built = buildPrompt(parsed, ctx);
        for await (const chunk of streamChat({
          system: built.system,
          user: built.user,
          temperature: built.temperature,
          userId,
        })) {
          if (chunk) send({ type: 'delta', text: chunk });
        }
        await incrementAiUsage(userId, 1);
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

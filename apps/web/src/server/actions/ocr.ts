'use server';

import 'server-only';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDecryptedSecret } from '@/server/ai/secrets';
import { env } from '@notai/lib';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { requireQuota, incrementAiUsage } from '@/server/plans';

/**
 * OCR an uploaded image asset using a vision-capable chat model. We
 * use the user's OpenAI BYOK key when present, falling back to the
 * deployment-level `OPENAI_API_KEY`. Copilot's vision surface varies
 * by tier and isn't reliable enough to depend on here, so we only
 * accept OpenAI-compatible providers in this first cut.
 *
 * The prompt is intentionally narrow so the model returns clean text
 * (no commentary, no Markdown wrappers). Result is capped at 16 KB so
 * an image full of dense text can't hammer the canvas.
 */

const inputSchema = z.object({
  noteId: z.string().min(1),
  imageUrl: z.string().url(),
  /** Optional override; defaults to gpt-4o-mini which has cheap vision. */
  model: z.string().max(80).optional(),
});

const SYSTEM = `You extract text from images. Output ONLY the text you read,
preserving line breaks and rough layout. Do not summarise. Do not describe
the image. Do not add commentary, headings, or Markdown fences. If the
image has no readable text, output exactly: (no text detected).`;

const PROMPT = `Extract every word of text visible in this image, preserving line breaks.`;

const MAX_OUTPUT = 16_000;

async function requireNoteAccess(noteId: string, userId: string) {
  const [row] = await db
    .select({ id: notes.id })
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
}

export async function ocrImage(
  rawInput: z.input<typeof inputSchema>,
): Promise<{ text: string; model: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sign in required');
  const { noteId, imageUrl, model } = inputSchema.parse(rawInput);
  await requireNoteAccess(noteId, userId);
  await requireQuota(userId, 'ai');

  const sec = await getDecryptedSecret(userId, 'openai');
  const apiKey = sec?.secret ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OCR needs an OpenAI key. Add one under Settings → AI providers.');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model ?? 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vision API error (${res.status}): ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const text = (json.choices?.[0]?.message?.content ?? '').trim().slice(0, MAX_OUTPUT);
  await incrementAiUsage(userId, 1);
  return { text, model: json.model ?? 'gpt-4o-mini' };
}

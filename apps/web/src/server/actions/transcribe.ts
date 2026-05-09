'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes } from '@notai/db';
import { getTranscribeProvider } from '@/server/ai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

const schema = z.object({
  filename: z.string().max(120).default('voice.webm'),
});

export interface TranscriptionResult {
  text: string;
}

/**
 * Transcribe an audio blob via the user's connected provider (currently
 * OpenAI Whisper). Receives multipart form data with the audio Blob in
 * the `audio` field.
 */
export async function transcribeAudio(form: FormData): Promise<TranscriptionResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('Not signed in');

  await requireQuota(userId, 'ai');

  const audio = form.get('audio');
  if (!(audio instanceof Blob)) throw new Error('Missing audio');
  const filename = schema.parse({
    filename: form.get('filename') ?? undefined,
  }).filename;

  const ctx = await getTranscribeProvider(userId);
  if (!ctx) {
    throw new Error(
      'Voice transcription is not configured. Add an OpenAI API key under Settings → AI providers.',
    );
  }
  const file = new File([audio], filename, {
    type: (audio as Blob).type || 'audio/webm',
  });
  const text = await ctx.provider.transcribe(file, ctx.model ?? undefined);
  if (text == null) {
    throw new Error('Transcription failed.');
  }
  await incrementAiUsage(userId, 1);
  return { text };
}

/**
 * Transcribe audio and immediately create a new note with the transcript
 * as plaintext. Used by the global voice-capture hotkey (Cmd/Ctrl+Shift+V).
 */
export async function createNoteFromVoice(
  form: FormData,
): Promise<{ id: string; title: string; text: string }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('Not signed in');

  await requireQuota(userId, 'notes');

  const { text } = await transcribeAudio(form);
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty transcript.');

  const firstLine = trimmed.split(/\n+/, 1)[0]?.slice(0, 80).trim() || 'Voice note';
  const title =
    firstLine.length < 4 ? `Voice — ${new Date().toISOString().slice(0, 10)}` : firstLine;

  const [row] = await db
    .insert(notes)
    .values({
      ownerId: userId,
      title,
      icon: '🎙️',
      kind: 'note',
      plaintext: trimmed,
    })
    .returning({ id: notes.id });

  if (!row) throw new Error('Failed to save voice note.');
  revalidatePath('/app');
  return { id: row.id, title, text: trimmed };
}

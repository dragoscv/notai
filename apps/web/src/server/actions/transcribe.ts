'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { getTranscribeProvider } from '@/server/ai';

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
  return { text };
}

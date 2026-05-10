'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes } from '@notai/db';
import { getTranscribeProvider, getTranscribeKey } from '@/server/ai';
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

export interface TranscriptSegment {
  /** Start time in seconds, relative to the recording. */
  start: number;
  /** End time in seconds. */
  end: number;
  text: string;
}

export interface SegmentedTranscriptionResult {
  segments: TranscriptSegment[];
  /** Joined plaintext, also returned for fallback / copy. */
  text: string;
}

const OPENAI_BASE = 'https://api.openai.com/v1';

/**
 * Transcribe an audio blob and return Whisper's per-segment timestamps
 * so the client can chunk the transcript into separate text elements
 * along natural pauses. Powers Voice Mode (canvas hold-to-record →
 * one paragraph per pause break).
 *
 * Goes around the standard `TranscribeProvider` interface because that
 * surface only returns `string | null`. We hit Whisper directly with
 * `response_format=verbose_json` + `timestamp_granularities=segment`.
 */
export async function transcribeAudioSegments(
  form: FormData,
): Promise<SegmentedTranscriptionResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('Not signed in');

  await requireQuota(userId, 'ai');

  const audio = form.get('audio');
  if (!(audio instanceof Blob)) throw new Error('Missing audio');
  const filename = schema.parse({ filename: form.get('filename') ?? undefined }).filename;

  const ctx = await getTranscribeKey(userId);
  if (!ctx) {
    throw new Error(
      'Voice transcription is not configured. Add an OpenAI API key under Settings → AI providers.',
    );
  }

  const file = new File([audio], filename, { type: audio.type || 'audio/webm' });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('model', ctx.model);
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'segment');

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Whisper failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    text?: string;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
  };
  await incrementAiUsage(userId, 1);

  const rawText = (json.text ?? '').trim();
  const segments: TranscriptSegment[] = Array.isArray(json.segments)
    ? json.segments
        .map((s) => ({
          start: typeof s.start === 'number' ? s.start : 0,
          end: typeof s.end === 'number' ? s.end : 0,
          text: (s.text ?? '').trim(),
        }))
        .filter((s) => s.text.length > 0)
    : [];

  return { segments, text: rawText };
}

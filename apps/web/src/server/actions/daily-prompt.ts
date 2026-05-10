'use server';

import { auth } from '@/auth';
import { streamChat } from '@/server/openai';
import { requireQuota, incrementAiUsage } from '@/server/plans';
import { createNote } from './notes';

export interface DailyPrompt {
  /** YYYY-MM-DD UTC bucket the prompt was generated for. */
  date: string;
  prompt: string;
}

const SYSTEM = `You are a thoughtful writing coach for an ADHD-friendly notes app.
Generate ONE short writing prompt (max 25 words) that nudges the user
to reflect, plan, or capture a small thought. Tone: warm, curious,
non-prescriptive. NO greetings, NO emojis, NO quotation marks. Just
the prompt sentence.`;

const PROMPTS_FALLBACK = [
  "What's one tiny thing you're glad you noticed today?",
  'If a problem you keep putting off only took 10 minutes, which would you start?',
  'What did you almost forget today that turned out to matter?',
  'Sketch the shape of how you felt this morning vs. now.',
  'Pick one open loop in your head and capture the smallest next step.',
  'Who did you think about today that you should send a message to?',
  'What did past-you do that present-you is grateful for?',
];

/**
 * Returns today's writing prompt. Generated once per UTC day per user
 * via streamChat (BYOK + quota), then cached in localStorage by the
 * client so the same prompt sticks for the day. We don't persist on
 * the server — the prompt is ephemeral by design.
 *
 * Falls back to a small rotating list when the user has no AI key
 * configured or the request fails — the dashboard card shouldn't
 * disappear just because the AI provider is grumpy.
 */
export async function getDailyPrompt(): Promise<DailyPrompt> {
  const today = new Date().toISOString().slice(0, 10);
  const session = await auth();
  if (!session?.user?.id) {
    return { date: today, prompt: pickFallback(today) };
  }
  const userId = session.user.id;
  try {
    await requireQuota(userId, 'ai');
    const stream = await streamChat({
      system: SYSTEM,
      user: `Generate today's prompt. Vary it from typical ones — favour curiosity over productivity.`,
      temperature: 0.85,
      userId,
    });
    let out = '';
    for await (const delta of stream) out += delta;
    out = out.trim().replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '');
    if (!out) return { date: today, prompt: pickFallback(today) };
    await incrementAiUsage(userId, 1);
    return { date: today, prompt: out };
  } catch {
    return { date: today, prompt: pickFallback(today) };
  }
}

function pickFallback(date: string): string {
  // Stable per-day pick from the fallback list — same prompt all day,
  // different across days.
  const seed = [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  return PROMPTS_FALLBACK[seed % PROMPTS_FALLBACK.length]!;
}

/**
 * Create a note seeded with today's prompt as its title and an empty
 * body. Returns the new note's id so the caller can navigate to it.
 */
export async function createNoteFromPrompt(prompt: string): Promise<{ id: string }> {
  const note = await createNote({ title: prompt.slice(0, 200), icon: '\u270d\ufe0f' });
  if (!note) throw new Error('Failed to create note.');
  return { id: note.id };
}

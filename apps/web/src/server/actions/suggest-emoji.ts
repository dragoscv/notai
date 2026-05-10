'use server';

import { auth } from '@/auth';
import { incrementAiUsage, requireQuota } from '@/server/plans';
import { streamChat } from '@/server/openai';

const SYSTEM = `You suggest a single emoji for a note title.
Rules:
- Output exactly one emoji character. No prose, no quotes, no period.
- The emoji should match the topic of the title.
- If the title is empty or generic ("Untitled", "Note"), output 📝.`;

const EMOJI_RE = /\p{Extended_Pictographic}/u;

/**
 * Returns an emoji suggested for the given title, or null if anything
 * fails. Cheap one-shot call: ~1 token output, ~5 input tokens.
 */
export async function suggestEmojiForTitle(title: string): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const t = title.trim().slice(0, 120);
  if (!t) return null;

  try {
    await requireQuota(userId, 'ai');
    const stream = await streamChat({
      system: SYSTEM,
      user: t,
      temperature: 0.3,
      userId,
    });
    let raw = '';
    for await (const delta of stream) raw += delta;
    await incrementAiUsage(userId, 1);

    const m = raw.match(EMOJI_RE);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

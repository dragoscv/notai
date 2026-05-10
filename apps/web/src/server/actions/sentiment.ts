'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, gte, isNull } from '@notai/db';

const POSITIVE = new Set([
  'good',
  'great',
  'amazing',
  'happy',
  'love',
  'loved',
  'excited',
  'win',
  'won',
  'progress',
  'proud',
  'calm',
  'grateful',
  'thanks',
  'awesome',
  'beautiful',
  'fun',
  'joy',
  'kind',
  'finally',
  'finished',
  'done',
  'complete',
  'shipped',
  'breakthrough',
  'energy',
  'focus',
  'clear',
  'better',
  'enjoy',
  'enjoyed',
  'celebrate',
  'success',
]);
const NEGATIVE = new Set([
  'bad',
  'sad',
  'angry',
  'frustrated',
  'tired',
  'exhausted',
  'stuck',
  'anxious',
  'anxiety',
  'worried',
  'worry',
  'overwhelmed',
  'fail',
  'failed',
  'broken',
  'hate',
  'hated',
  'lost',
  'mess',
  'panic',
  'scared',
  'stress',
  'stressed',
  'sick',
  'depressed',
  'lonely',
  'hopeless',
  'pain',
  'hurt',
  'guilt',
  'guilty',
  'ashamed',
  'fear',
]);

const TOKEN = /[a-z']+/g;

function scoreText(text: string): { score: number; words: number } {
  let pos = 0;
  let neg = 0;
  let words = 0;
  for (const m of text.toLowerCase().matchAll(TOKEN)) {
    const w = m[0];
    words++;
    if (POSITIVE.has(w)) pos++;
    else if (NEGATIVE.has(w)) neg++;
  }
  if (pos === 0 && neg === 0) return { score: 0, words };
  return { score: (pos - neg) / Math.max(1, pos + neg), words };
}

export interface SentimentDay {
  date: string;
  /** -1..+1 weighted by word count, or null when no notes that day. */
  score: number | null;
  /** how many notes were written that day */
  notes: number;
}

/**
 * Last 30 days of note activity, scored with a tiny keyword bag.
 * No external AI calls, no schema changes, no PII leaving the DB.
 */
export async function getSentimentLast30(): Promise<SentimentDay[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ updatedAt: notes.updatedAt, plaintext: notes.plaintext })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt), gte(notes.updatedAt, since)));

  // Aggregate: { 'YYYY-MM-DD': { sumWeighted, sumWeights, notes } }
  const byDay = new Map<string, { sumW: number; w: number; notes: number }>();
  for (const r of rows) {
    if (!r.plaintext) continue;
    const d = new Date(r.updatedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { score, words } = scoreText(r.plaintext);
    const weight = Math.min(1, words / 50);
    const cur = byDay.get(key) ?? { sumW: 0, w: 0, notes: 0 };
    cur.sumW += score * weight;
    cur.w += weight;
    cur.notes += 1;
    byDay.set(key, cur);
  }

  const days: SentimentDay[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const agg = byDay.get(key);
    days.push({
      date: key,
      score: agg && agg.w > 0 ? agg.sumW / agg.w : agg ? 0 : null,
      notes: agg?.notes ?? 0,
    });
  }
  return days;
}

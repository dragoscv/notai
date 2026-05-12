'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, or, isNull, desc, gte, sql } from '@notai/db';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, QuotaExceededError, requireQuota } from '@/server/plans';

const MAX_RECENT = 12;
const MAX_PINNED = 6;
const RECENT_WINDOW_HOURS = 36;

const SYSTEM = `You are a calm, ADHD-friendly executive assistant.
You write a short morning brief based on the user's recent notes.

Rules:
- Output GitHub-flavoured Markdown.
- Maximum 220 words. No fluff.
- Lead with one sentence: the day's clear focus, drawn from pinned notes
  or the most-modified work-in-progress note.
- Then up to 5 bullets across these sections (skip any that are empty):
  - **Pick up where you left off** — recent unfinished threads.
  - **Open action items** — concrete \`- [ ]\` lines you saw.
  - **Worth re-reading** — at most one note that may be relevant today.
- Refer to notes by title only. Never invent titles or facts.
- No greetings. No closings. No emoji. Sentence-case headings.`;

export interface MorningBriefSource {
  id: string;
  title: string;
}

export interface MorningBriefResult {
  markdown: string;
  generatedAt: string;
  usedNotes: number;
  sources: MorningBriefSource[];
}

interface BriefSourceNote {
  id: string;
  title: string | null;
  plaintext: string;
  isPinned: boolean;
  isPinnedOnToday: boolean;
  updatedAt: Date;
}

function extractActionItems(text: string, max: number): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*]\s+)?\[\s\](\s.+)$/);
    if (m && m[1]) {
      out.push(m[1].trim());
      if (out.length >= max) break;
    }
  }
  return out;
}

export async function generateMorningBrief(): Promise<MorningBriefResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!userId) throw new Error('Not signed in');
  try {
    await requireQuota(userId, 'ai');
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return {
        markdown:
          "AI brief is paused — you've used your AI actions for this period. Upgrade to keep daily briefs flowing, or check back next month.",
        generatedAt: new Date().toISOString(),
        usedNotes: 0,
        sources: [],
      };
    }
    throw err;
  }

  const since = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);

  const recent = (await db
    .select({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
      isPinned: notes.isPinned,
      isPinnedOnToday: notes.isPinnedOnToday,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, userId),
        isNull(notes.deletedAt),
        or(gte(notes.updatedAt, since), eq(notes.isPinned, true), eq(notes.isPinnedOnToday, true)),
      ),
    )
    .orderBy(desc(notes.isPinnedOnToday), desc(notes.isPinned), desc(notes.updatedAt))
    .limit(MAX_RECENT + MAX_PINNED)) as BriefSourceNote[];

  if (recent.length === 0) {
    return {
      markdown:
        'No recent notes yet. Capture a thought (⌘.) or open today’s daily note to get started.',
      generatedAt: new Date().toISOString(),
      usedNotes: 0,
      sources: [],
    };
  }

  const lines: string[] = [];
  for (const n of recent) {
    const tag = n.isPinnedOnToday
      ? '[Today]'
      : n.isPinned
        ? '[Pinned]'
        : `[${formatRelative(n.updatedAt)}]`;
    const head = `${tag} ${n.title || 'Untitled'}`;
    const snippet = (n.plaintext ?? '').slice(0, 600).replace(/\s+/g, ' ').trim();
    const todos = extractActionItems(n.plaintext ?? '', 3);
    lines.push(`### ${head}`);
    if (snippet) lines.push(snippet);
    if (todos.length) {
      lines.push(...todos.map((t) => `- [ ] ${t}`));
    }
    lines.push('');
  }
  const corpus = lines.join('\n').slice(0, 14000);

  let result = '';
  for await (const delta of streamChat({
    system: SYSTEM,
    user: `Today is ${new Date().toDateString()}. Here is the user's recent activity:\n\n${corpus}\n\nWrite the brief.`,
    temperature: 0.3,
    userId,
  })) {
    result += delta;
  }
  await incrementAiUsage(userId, 1);

  return {
    markdown: result.trim() || 'Nothing notable in the last day. A good day to plan.',
    generatedAt: new Date().toISOString(),
    usedNotes: recent.length,
    sources: recent.slice(0, 6).map((n) => ({ id: n.id, title: n.title || 'Untitled' })),
  };
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const h = Math.floor(ms / (60 * 60 * 1000));
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

const FOLLOWUP_SYSTEM = `You are a calm, ADHD-friendly executive assistant.
The user has just read their morning brief and is asking a follow-up
question about it. Answer concisely and only from the brief and listed
sources. If the answer isn't in the provided context, say so plainly
in one sentence — do not invent. Keep responses under 120 words.
No greetings. No emoji.`;

export interface MorningBriefFollowupInput {
  question: string;
  briefMarkdown: string;
  sources: MorningBriefSource[];
}

export interface MorningBriefFollowupResult {
  answer: string;
}

/**
 * Ask a focused question about the morning brief. Uses the brief
 * markdown plus the contributing source titles as the only context —
 * no additional vector retrieval — so answers stay grounded in what
 * the user just read.
 */
export async function askMorningBriefFollowup(
  input: MorningBriefFollowupInput,
): Promise<MorningBriefFollowupResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  await requireQuota(userId, 'ai');

  const question = input.question.trim().slice(0, 800);
  if (question.length < 2) throw new Error('Question is too short');
  const brief = input.briefMarkdown.trim().slice(0, 4000);
  const sourceList =
    input.sources.length > 0
      ? input.sources.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
      : '(no sources)';

  const userPrompt = `Morning brief:\n\n${brief}\n\nSources:\n${sourceList}\n\nUser question: ${question}\n\nAnswer:`;

  let result = '';
  for await (const delta of streamChat({
    system: FOLLOWUP_SYSTEM,
    user: userPrompt,
    temperature: 0.2,
    userId,
  })) {
    result += delta;
  }
  await incrementAiUsage(userId, 1);
  const answer = result.trim();
  return {
    answer:
      answer ||
      "I couldn't find that in your brief. Try asking the full Ask page for a deeper search.",
  };
}

void sql; // exported by @notai/db — referenced for parity with sibling actions even when unused.

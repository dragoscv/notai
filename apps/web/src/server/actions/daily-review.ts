'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, gte, sql, desc } from '@notai/db';
import { requireQuota, incrementAiUsage } from '@/server/plans';
import { streamChat } from '@/server/openai';

const SYSTEM = `You are a calm, ADHD-friendly journaling coach.
Given a list of today's note titles and short excerpts, write a 4-6 sentence wrap-up:
1. One sentence celebrating what got done.
2. 2-3 sentences listing the top 2-3 themes you noticed.
3. One sentence with a gentle suggestion for tomorrow (e.g. a follow-up to revisit).
Be warm, concrete, no bullet points, no markdown headings, plain prose.`;

interface ReviewSource {
  title: string;
  excerpt: string;
}

/**
 * Compose an end-of-day review of today's note activity. Returns a
 * short prose summary plus the list of contributing notes so the UI
 * can link back to them.
 */
export async function dailyReview(): Promise<{
  summary: string;
  notes: Array<{ id: string; title: string; icon: string | null }>;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  await requireQuota(userId, 'ai');

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
    })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt), gte(notes.updatedAt, since)))
    .orderBy(desc(notes.updatedAt))
    .limit(20);

  if (rows.length === 0) {
    return {
      summary: "Nothing's been edited today yet \u2014 take a moment, then come back.",
      notes: [],
    };
  }

  const sources: ReviewSource[] = rows.map((r) => ({
    title: r.title || 'Untitled',
    excerpt: (r.plaintext ?? '').slice(0, 400).trim(),
  }));

  const userPrompt =
    `Today the user touched ${rows.length} note${rows.length === 1 ? '' : 's'}.\n\n` +
    sources.map((s, i) => `${i + 1}. ${s.title}\n${s.excerpt || '(no text yet)'}`).join('\n\n');

  let summary = '';
  try {
    for await (const chunk of streamChat({
      system: SYSTEM,
      user: userPrompt,
      temperature: 0.5,
      userId,
    })) {
      summary += chunk;
    }
  } catch {
    summary = `You touched ${rows.length} notes today. ${sources
      .slice(0, 3)
      .map((s) => `\u201c${s.title}\u201d`)
      .join(', ')}. Nice steady progress \u2014 leave the rest for tomorrow.`;
  }

  await incrementAiUsage(userId).catch(() => undefined);
  void sql; // keep import stable for future filters

  return {
    summary: summary.trim(),
    notes: rows.map((r) => ({ id: r.id, title: r.title, icon: r.icon })),
  };
}

'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, sql, desc } from '@notai/db';
import { streamChat } from '@/server/openai';
import { requireQuota, incrementAiUsage } from '@/server/plans';
import { createNote } from './notes';

export interface DailyRecap {
  date: string;
  noteCount: number;
  wordCount: number;
  summary: string | null;
  noteIds: string[];
}

const SYSTEM = `Summarise what the user wrote today across these note snippets.
- 2-4 short bullets (\u2022 prefix), each <= 18 words.
- Surface concrete topics, decisions, and open questions \u2014 NOT meta talk like "the user wrote about X".
- If notes are mostly empty/tiny, return a single bullet: "\u2022 Light writing day."
- No greetings, no headers, no markdown beyond the bullet character.`;

/**
 * End-of-day recap of everything the user wrote today (their local
 * day, approximated as UTC for now). Returns counts always; the LLM
 * summary only when there's enough material AND the user has an AI
 * provider configured.
 */
export async function getDailyRecap(): Promise<DailyRecap> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      date: new Date().toISOString().slice(0, 10),
      noteCount: 0,
      wordCount: 0,
      summary: null,
      noteIds: [],
    };
  }
  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
    })
    .from(notes)
    .where(
      and(eq(notes.ownerId, userId), sql`date_trunc('day', ${notes.updatedAt}) = current_date`),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(20);

  let wordCount = 0;
  const corpusParts: string[] = [];
  for (const r of rows) {
    const txt = (r.plaintext ?? '').trim();
    if (txt) wordCount += txt.split(/\s+/).filter(Boolean).length;
    if (txt.length > 0) {
      corpusParts.push(`# ${r.title || 'Untitled'}\n${txt.slice(0, 1500)}`);
    }
  }
  const noteIds = rows.map((r) => r.id);
  const noteCount = rows.length;

  if (noteCount === 0 || wordCount < 30) {
    return { date: today, noteCount, wordCount, summary: null, noteIds };
  }

  try {
    await requireQuota(userId, 'ai');
    const stream = await streamChat({
      system: SYSTEM,
      user: corpusParts.join('\n\n---\n\n').slice(0, 12000),
      temperature: 0.3,
      userId,
    });
    let out = '';
    for await (const delta of stream) out += delta;
    out = out.trim();
    await incrementAiUsage(userId, 1);
    return { date: today, noteCount, wordCount, summary: out || null, noteIds };
  } catch {
    return { date: today, noteCount, wordCount, summary: null, noteIds };
  }
}

/** Save the recap as a note titled "Daily recap \u2014 YYYY-MM-DD". */
export async function saveRecapAsNote(input: {
  date: string;
  summary: string;
}): Promise<{ id: string }> {
  const note = await createNote({
    title: `Daily recap \u2014 ${input.date}`,
    icon: '\ud83d\udcdd',
  });
  if (!note) throw new Error('Failed to create note.');
  // Stash the body for the editor to pick up via the existing
  // pending-append handoff. This keeps daily-recap on the same path
  // every other "create + seed body" flow uses.
  return { id: note.id };
}

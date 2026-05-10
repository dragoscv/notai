'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, sql, desc } from '@notai/db';

export interface OpenLoop {
  noteId: string;
  noteTitle: string | null;
  noteIcon: string | null;
  text: string;
}

const MAX_TOTAL = 10;
const MAX_PER_NOTE = 3;
const TODO_RE = /^[\s>*-]*\[\s\]\s+(.+?)$/m;
const TODO_RE_GLOBAL = /^[\s>*-]*\[\s\]\s+(.+?)$/gm;

/**
 * "Open loops" \u2014 every unchecked `[ ] \u2026` TODO across every recently
 * touched note, rolled up into one ADHD-friendly list. Differs from
 * `stale-todos.ts` by intent: stale TODOs are about *forgotten* work
 * (>= 14 days untouched), open loops are about *current* work the
 * user is already juggling. We cap to 10 total so the card stays
 * scannable.
 */
export async function getOpenLoops(): Promise<OpenLoop[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
    })
    .from(notes)
    .where(
      and(eq(notes.ownerId, userId), isNull(notes.deletedAt), sql`${notes.plaintext} ~ '\\[ \\]'`),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(40);

  const out: OpenLoop[] = [];
  for (const row of rows) {
    const txt = row.plaintext ?? '';
    const matches = txt.match(TODO_RE_GLOBAL) ?? [];
    let kept = 0;
    for (const raw of matches) {
      if (kept >= MAX_PER_NOTE) break;
      const m = TODO_RE.exec(raw);
      if (!m) continue;
      const text = (m[1] ?? '').trim();
      if (!text) continue;
      out.push({
        noteId: row.id,
        noteTitle: row.title ?? null,
        noteIcon: row.icon ?? null,
        text,
      });
      kept++;
      if (out.length >= MAX_TOTAL) return out;
    }
  }
  return out;
}

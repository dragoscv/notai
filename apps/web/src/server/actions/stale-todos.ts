'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, sql, desc } from '@notai/db';

export interface StaleTodo {
  noteId: string;
  noteTitle: string | null;
  noteIcon: string | null;
  text: string;
  daysAgo: number;
}

const MIN_STALENESS_DAYS = 14;
const MAX_TODOS = 6;
const TODO_RE = /^[\s>*-]*\[\s\]\s+(.+?)$/m;
const TODO_RE_GLOBAL = /^[\s>*-]*\[\s\]\s+(.+?)$/gm;

/**
 * Stale TODO digest — surfaces unchecked `[ ] …` lines from notes that
 * haven't been touched in 14+ days. ADHD-friendly nudge: things you
 * meant to do, easy to forget. We scan `notes.plaintext` (the text
 * cache populated by the embed-notes worker) so this is a single
 * cheap query, no per-note doc parsing.
 */
export async function getStaleTodos(): Promise<StaleTodo[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const candidates = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, userId),
        isNull(notes.deletedAt),
        sql`${notes.updatedAt} < now() - interval '${sql.raw(String(MIN_STALENESS_DAYS))} days'`,
        sql`${notes.plaintext} ~ '\\[ \\]'`,
      ),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(50);

  const now = Date.now();
  const out: StaleTodo[] = [];
  for (const row of candidates) {
    const txt = row.plaintext ?? '';
    if (!TODO_RE.test(txt)) continue;
    const matches = txt.match(TODO_RE_GLOBAL) ?? [];
    const days = Math.floor((now - row.updatedAt.getTime()) / 86_400_000);
    for (const raw of matches.slice(0, 3)) {
      const m = TODO_RE.exec(raw);
      if (!m) continue;
      const text = m[1]!.trim().slice(0, 140);
      if (!text) continue;
      out.push({
        noteId: row.id,
        noteTitle: row.title,
        noteIcon: row.icon,
        text,
        daysAgo: days,
      });
      if (out.length >= MAX_TODOS) return out;
    }
  }
  return out;
}

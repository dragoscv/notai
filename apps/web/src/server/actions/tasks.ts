'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, sql, desc } from '@notai/db';
import { parseTaskLine, priorityWeight, TODO_LINE_GLOBAL, type ParsedTask } from '@/lib/tasks';

export interface Task extends ParsedTask {
  noteId: string;
  noteTitle: string | null;
  noteIcon: string | null;
}

interface ListOpts {
  range?: 'today' | 'overdue' | 'next7' | 'all';
  limit?: number;
}

/**
 * Pulls every `[ ] …` line across the user's recently-touched notes,
 * parses it for `@due` / `@every` / `!!priority`, and filters by the
 * given range. Read-only — scheduling/completion is done in the source
 * note via the editor canvas.
 */
export async function listTasks({ range = 'all', limit = 100 }: ListOpts = {}): Promise<Task[]> {
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
    .limit(200);

  const out: Task[] = [];
  for (const row of rows) {
    const txt = row.plaintext ?? '';
    const matches = txt.match(TODO_LINE_GLOBAL) ?? [];
    for (const raw of matches) {
      const parsed = parseTaskLine(raw);
      if (!parsed) continue;
      if (range === 'today' && parsed.daysUntil !== 0) continue;
      if (range === 'overdue' && (parsed.daysUntil == null || parsed.daysUntil >= 0)) continue;
      if (
        range === 'next7' &&
        (parsed.daysUntil == null || parsed.daysUntil < 0 || parsed.daysUntil > 7)
      )
        continue;
      out.push({
        ...parsed,
        noteId: row.id,
        noteTitle: row.title ?? null,
        noteIcon: row.icon ?? null,
      });
      if (out.length >= limit) return sortTasks(out);
    }
  }
  return sortTasks(out);
}

function sortTasks(arr: Task[]): Task[] {
  return [...arr].sort((a, b) => {
    const ad = a.daysUntil ?? Number.POSITIVE_INFINITY;
    const bd = b.daysUntil ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return priorityWeight(a.priority) - priorityWeight(b.priority);
  });
}

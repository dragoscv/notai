'use server';

/**
 * One-line AI gist for unfiled inbox notes. The Inbox-Zero UI uses
 * this to show a quick "what is this note about" hint next to each
 * item without making the user open the note.
 *
 * Batches up to 12 notes per call so cost is one streamChat per
 * batch \u2014 not per note. Returns an id\u2192gist map; falls back to a
 * smart truncation of the plaintext if the AI returns nothing.
 */

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, eq, and, isNull, inArray } from '@notai/db';
import { streamChat } from '@/server/openai';
import { requireQuota, incrementAiUsage } from '@/server/plans';

const inputSchema = z.object({
  noteIds: z.array(z.string()).min(1).max(12),
});

const SYSTEM = `You write extremely short summaries for an ADHD-friendly notes
inbox. For each numbered note, return a single line of \u2264 80 characters
that captures the essence \u2014 no greeting, no preamble. If the note is
empty or trivial, return "(empty)" for that line. Output exactly one
line per input, in the same order, prefixed with the number. Example:
"1. weekly groceries shortlist".`;

function smartFallback(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '(empty)';
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  if (firstLine.length >= 8) return firstLine.slice(0, 80);
  return trimmed.slice(0, 80);
}

export async function summarizeInboxItems(
  input: z.input<typeof inputSchema>,
): Promise<Record<string, string>> {
  const { noteIds } = inputSchema.parse(input);
  const session = await auth();
  if (!session?.user?.id) return {};
  const userId = session.user.id;

  const rows = await db
    .select({ id: notes.id, plaintext: notes.plaintext, title: notes.title })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), inArray(notes.id, noteIds), isNull(notes.deletedAt)));

  type Row = (typeof rows)[number];
  const ordered: Row[] = noteIds
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is Row => r !== undefined);
  if (ordered.length === 0) return {};

  const fallback: Record<string, string> = {};
  const lines = ordered.map((r, i) => {
    const body = (r.plaintext ?? '').slice(0, 600);
    fallback[r.id] = smartFallback(`${r.title}\n${body}`);
    return `${i + 1}. ${r.title || 'Untitled'}\n${body}`.trim();
  });

  try {
    await requireQuota(userId, 'ai');
    const stream = await streamChat({
      system: SYSTEM,
      user: lines.join('\n\n---\n\n'),
      temperature: 0.2,
      userId,
    });
    let raw = '';
    for await (const delta of stream) raw += delta;
    await incrementAiUsage(userId, 1);

    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(\d+)\.\s*(.+?)\s*$/);
      if (!m) continue;
      const idx = Number(m[1]) - 1;
      const id = ordered[idx]?.id;
      if (!id) continue;
      out[id] = m[2]!.slice(0, 100);
    }
    // Backfill anything the AI skipped with the heuristic.
    for (const r of ordered) if (!out[r.id]) out[r.id] = fallback[r.id]!;
    return out;
  } catch {
    return fallback;
  }
}

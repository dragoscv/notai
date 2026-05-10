'use server';

import { auth } from '@/auth';
import { db, notes, eq, and, isNull, sql } from '@notai/db';

export interface ThrowbackNote {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  updatedAt: string;
  daysAgo: number;
}

const MIN_DAYS_AGO = 30;
const MAX_NOTES_TO_SAMPLE = 200;

/**
 * "On this day"-style nostalgia card. Surfaces a single random note
 * the user hasn't touched in 30+ days so they get a free surface area
 * for retrieval — ADHD-friendly recall: the brain forgets, the app
 * remembers, and a casual nudge ("hey, remember this?") is way more
 * effective than expecting users to dig through their archive.
 *
 * Implementation: pull the oldest 200 untouched-for-30-days notes and
 * pick one at random. We deliberately bias toward older content (cap
 * at 200 by ascending updatedAt order) rather than uniform-random across
 * all notes — the goal is genuine throwback, not just any random note.
 */
export async function getThrowbackNote(): Promise<ThrowbackNote | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  const cutoff = sql`now() - interval '${sql.raw(`${MIN_DAYS_AGO} days`)}'`;
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      and(eq(notes.ownerId, userId), isNull(notes.deletedAt), sql`${notes.updatedAt} < ${cutoff}`),
    )
    .orderBy(notes.updatedAt)
    .limit(MAX_NOTES_TO_SAMPLE);
  if (rows.length === 0) return null;

  const pick = rows[Math.floor(Math.random() * rows.length)];
  if (!pick) return null;
  const updatedAtDate = pick.updatedAt instanceof Date ? pick.updatedAt : new Date(pick.updatedAt);
  const daysAgo = Math.floor((Date.now() - updatedAtDate.getTime()) / (24 * 60 * 60 * 1000));
  const snippet = (pick.plaintext ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);

  return {
    id: pick.id,
    title: pick.title?.trim() || 'Untitled',
    icon: pick.icon,
    snippet,
    updatedAt: updatedAtDate.toISOString(),
    daysAgo,
  };
}

'use server';

import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull, gte, desc } from '@notai/db';

export interface ReviewItem {
  id: string;
  title: string | null;
  icon: string | null;
  updatedAt: Date;
  /** Cheap proxy for "depth of work" — lets the UI rank notes the
   *  user actually invested in this week, not just things they touched
   *  briefly. */
  charCount: number;
}

export interface WeeklyReview {
  windowStart: Date;
  items: ReviewItem[];
  createdCount: number;
  touchedCount: number;
}

const WINDOW_DAYS = 7;
const TOP_N = 8;

/**
 * Returns the notes the current user touched in the last 7 days,
 * ordered by recency, plus headline counts for the dashboard card.
 * Read-only — pure dashboard surface.
 */
export async function getWeeklyReview(): Promise<WeeklyReview | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .selectDistinct({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      updatedAt: notes.updatedAt,
      createdAt: notes.createdAt,
      plaintext: notes.plaintext,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        gte(notes.updatedAt, windowStart),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(200);

  const createdCount = rows.filter((r) => r.createdAt >= windowStart).length;
  const items: ReviewItem[] = rows.slice(0, TOP_N).map((r) => ({
    id: r.id,
    title: r.title ?? null,
    icon: r.icon ?? null,
    updatedAt: r.updatedAt,
    charCount: r.plaintext ? r.plaintext.length : 0,
  }));

  return {
    windowStart,
    items,
    createdCount,
    touchedCount: rows.length,
  };
}

'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, flashcards, flashcardReviews, eq, and, asc, lte, desc, sql } from '@notai/db';
import { scheduleNext } from '@notai/lib';
import { revalidatePath } from 'next/cache';

const createSchema = z.object({
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(4000),
  noteId: z.string().min(1).max(64).nullable().optional(),
  workspaceId: z.string().min(1).max(64).nullable().optional(),
});

export async function createFlashcard(input: z.input<typeof createSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const data = createSchema.parse(input);
  const [row] = await db
    .insert(flashcards)
    .values({
      userId: session.user.id,
      front: data.front,
      back: data.back,
      noteId: data.noteId ?? null,
      workspaceId: data.workspaceId ?? null,
    })
    .returning();
  revalidatePath('/app/review');
  return row;
}

const updateSchema = z.object({
  id: z.string().min(1).max(64),
  front: z.string().trim().min(1).max(2000).optional(),
  back: z.string().trim().min(1).max(4000).optional(),
});

export async function updateFlashcard(input: z.input<typeof updateSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { id, front, back } = updateSchema.parse(input);
  await db
    .update(flashcards)
    .set({
      ...(front !== undefined ? { front } : {}),
      ...(back !== undefined ? { back } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(flashcards.id, id), eq(flashcards.userId, session.user.id)));
  revalidatePath('/app/review');
}

export async function deleteFlashcard(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .delete(flashcards)
    .where(and(eq(flashcards.id, id), eq(flashcards.userId, session.user.id)));
  revalidatePath('/app/review');
}

export async function listDueFlashcards(limit = 50) {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.userId, session.user.id), lte(flashcards.dueAt, new Date())))
    .orderBy(asc(flashcards.dueAt))
    .limit(limit);
}

export async function listAllFlashcards(limit = 200) {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db
    .select()
    .from(flashcards)
    .where(eq(flashcards.userId, session.user.id))
    .orderBy(desc(flashcards.createdAt))
    .limit(limit);
}

export async function flashcardStats() {
  const session = await auth();
  if (!session?.user?.id) return { total: 0, due: 0, reviewedToday: 0 };
  const userId = session.user.id;
  const [{ total = 0 } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(flashcards)
    .where(eq(flashcards.userId, userId));
  const [{ due = 0 } = { due: 0 }] = await db
    .select({ due: sql<number>`count(*)::int` })
    .from(flashcards)
    .where(and(eq(flashcards.userId, userId), lte(flashcards.dueAt, new Date())));
  const [{ reviewedToday = 0 } = { reviewedToday: 0 }] = await db
    .select({ reviewedToday: sql<number>`count(*)::int` })
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.userId, userId),
        sql`${flashcardReviews.reviewedAt} >= now() - interval '24 hours'`,
      ),
    );
  return { total, due, reviewedToday };
}

const reviewSchema = z.object({
  id: z.string().min(1).max(64),
  quality: z.number().int().min(0).max(5),
});

export async function reviewFlashcard(input: z.input<typeof reviewSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { id, quality } = reviewSchema.parse(input);
  const [card] = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.id, id), eq(flashcards.userId, session.user.id)))
    .limit(1);
  if (!card) throw new Error('Card not found');

  const next = scheduleNext(
    {
      easeFactor: card.easeFactor,
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
      lapses: card.lapses,
    },
    quality,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(flashcards)
      .set({
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        lapses: next.lapses,
        dueAt: next.dueAt,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flashcards.id, id));
    await tx.insert(flashcardReviews).values({
      flashcardId: id,
      userId: session.user!.id!,
      quality,
      prevInterval: card.intervalDays,
      nextInterval: next.intervalDays,
      easeFactorAfter: next.easeFactor,
    });
  });

  revalidatePath('/app/review');
  return { dueAt: next.dueAt, intervalDays: next.intervalDays };
}

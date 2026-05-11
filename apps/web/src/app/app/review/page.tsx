import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { listDueFlashcards, listAllFlashcards, flashcardStats } from '@/server/actions/flashcards';
import { ReviewClient } from './review-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review · notai' };

export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [due, all, stats] = await Promise.all([
    listDueFlashcards(50),
    listAllFlashcards(200),
    flashcardStats(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Spaced repetition</h1>
        <p className="text-muted-foreground text-sm">
          {stats.due} due · {stats.total} total · {stats.reviewedToday} reviewed in last 24h
        </p>
      </header>
      <ReviewClient
        initialDue={due.map((c) => ({ id: c.id, front: c.front, back: c.back }))}
        allCards={all.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          dueAt: c.dueAt.toISOString(),
          intervalDays: c.intervalDays,
        }))}
      />
    </div>
  );
}

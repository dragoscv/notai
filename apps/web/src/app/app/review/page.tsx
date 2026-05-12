import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { listDueFlashcards, listAllFlashcards, flashcardStats } from '@/server/actions/flashcards';
import { ReviewClient } from './review-client';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const t = await getTranslations('pages.review');
  return { title: t('metaTitle') };
}

export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [due, all, stats, t] = await Promise.all([
    listDueFlashcards(50),
    listAllFlashcards(200),
    flashcardStats(),
    getTranslations('pages.review'),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('summary', {
            due: stats.due,
            total: stats.total,
            reviewed: stats.reviewedToday,
          })}
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

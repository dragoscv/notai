import Link from 'next/link';
import { CalendarRange, FileText } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getWeeklyReview } from '@/server/actions/weekly-review';

/**
 * Weekly review surface — quiet by default. Renders nothing when the
 * user touched no notes in the last 7 days, so we don't dilute the
 * dashboard for inactive accounts.
 */
export async function WeeklyReviewCard() {
  const review = await getWeeklyReview();
  if (!review || review.touchedCount === 0) return null;
  const t = await getTranslations('dashboard.weeklyReview');

  function relativeDay(d: Date): string {
    const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return t('relativeToday');
    if (days === 1) return t('relativeYesterday');
    return t('relativeDaysAgo', { count: days });
  }

  return (
    <section className="bg-card text-card-foreground my-3 rounded-lg border p-4 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="size-4 opacity-70" />
          {t('title')}
        </h2>
        <span className="text-muted-foreground text-xs">
          {t('summary', { touched: review.touchedCount, created: review.createdCount })}
        </span>
      </header>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {review.items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/app/n/${it.id}`}
              className="hover:bg-muted flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
            >
              <span className="shrink-0">
                {it.icon || <FileText className="text-muted-foreground size-3.5" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{it.title || t('untitled')}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {relativeDay(it.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

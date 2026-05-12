import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getUserStats } from '@/server/actions/stats';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const stats = await getUserStats();
  if (!stats) redirect('/signin');
  const t = await getTranslations('pages.stats');

  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/app"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('back')}
        </Link>
        <h1 className="ml-2 inline-flex items-center gap-2 text-2xl font-semibold">
          <BarChart3 className="text-primary size-6" /> {t('title')}
        </h1>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('totalNotes')} value={stats.totalNotes} />
        <Stat label={t('last7Days')} value={stats.notesLast7Days} accent />
        <Stat label={t('favorites')} value={stats.totalFavorites} />
        <Stat label={t('archived')} value={stats.totalArchived} />
      </section>

      <section className="bg-card mt-8 rounded-2xl border p-5">
        <h2 className="text-sm font-medium">{t('sectionTitle30d')}</h2>
        <p className="text-muted-foreground text-xs">
          {t('sectionSummary30d', { count: stats.notesLast30Days })}
        </p>
        <div className="mt-4 flex h-32 items-end gap-1">
          {stats.daily.length === 0 ? (
            <p className="text-muted-foreground self-center text-xs">{t('noActivity')}</p>
          ) : (
            stats.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                className="bg-primary/70 hover:bg-primary flex-1 rounded-t-sm transition"
                style={{ height: `${(d.count / maxDaily) * 100}%` }}
              />
            ))
          )}
        </div>
      </section>

      <section className="bg-card mt-6 rounded-2xl border p-5">
        <h2 className="text-sm font-medium">{t('topTags')}</h2>
        {stats.topTags.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-xs">{t('noTags')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.topTags.map((tag) => (
              <span
                key={tag.tag}
                className="bg-muted text-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
              >
                <span className="font-medium">#{tag.tag}</span>
                <span className="text-muted-foreground">{tag.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={
        'rounded-2xl border p-4 ' + (accent ? 'bg-primary/10 border-primary/30' : 'bg-card')
      }
    >
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

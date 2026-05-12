'use client';

import * as React from 'react';
import { getSentimentLast30, type SentimentDay } from '@/server/actions/sentiment';
import { HeartPulse } from 'lucide-react';
import { useTranslations } from 'next-intl';

function colorFor(score: number | null, notes: number): string {
  if (score === null) return 'rgb(127 127 127 / 0.06)';
  // Score in -1..+1 -> hue 0 (red) ... 50 (yellow) ... 130 (green).
  const hue = Math.round(50 + score * 80);
  const sat = 65;
  const light = 55;
  const alpha = Math.max(0.18, Math.min(0.85, 0.25 + notes * 0.15));
  return `hsl(${hue} ${sat}% ${light}% / ${alpha})`;
}

/**
 * 30-day mood heatmap for the dashboard. Reads aggregate sentiment
 * from `getSentimentLast30` (no AI calls, keyword-bag only) and
 * renders a small inline grid with hover tooltips.
 */
export function SentimentHeatmap() {
  const t = useTranslations('dashboard.sentimentHeatmap');
  const [days, setDays] = React.useState<SentimentDay[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getSentimentLast30()
      .then((rows) => {
        if (!cancelled) setDays(rows);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!days || days.length === 0) return null;

  const wrote = days.filter((d) => d.notes > 0).length;
  return (
    <section className="bg-card rounded-xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <HeartPulse className="size-3.5" />
        <span>{t('label')}</span>
        <span className="ml-auto normal-case tracking-normal">
          {t('wroteOn', { count: wrote })}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
        {days.map((d) => {
          const noteWord = d.notes === 1 ? t('noteWordOne') : t('noteWordOther');
          const title =
            d.score === null
              ? t('tooltipNothing', { date: d.date })
              : d.score > 0.15
                ? t('tooltipPositive', { date: d.date, count: d.notes, noteWord })
                : d.score < -0.15
                  ? t('tooltipTense', { date: d.date, count: d.notes, noteWord })
                  : t('tooltipNeutral', { date: d.date, count: d.notes, noteWord });
          return (
            <div
              key={d.date}
              title={title}
              style={{ background: colorFor(d.score, d.notes) }}
              className="aspect-square rounded-sm border border-black/5 dark:border-white/5"
            />
          );
        })}
      </div>
      <p className="text-muted-foreground mt-2 text-[10px]">{t('footer')}</p>
    </section>
  );
}

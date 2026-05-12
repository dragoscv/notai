'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Small chip showing word count + estimated reading time for the note's
 * plaintext. Reads the server-snapshot `plaintext` so the value lags
 * realtime edits slightly — that's fine for a passive indicator, and
 * keeps us out of the Y.Doc traversal hot path.
 *
 * Reading-time uses the conventional 200 wpm baseline. Sub-minute notes
 * report as "<1 min".
 */
export function NoteStatsChip({ plaintext }: { plaintext: string | null }) {
  const t = useTranslations('noteWorkspace.stats');
  const stats = React.useMemo(() => {
    const text = (plaintext ?? '').trim();
    if (!text) return { words: 0, minutes: 0 };
    const words = text.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return { words, minutes };
  }, [plaintext]);

  if (stats.words === 0) return null;

  const wordsLabel = stats.words.toLocaleString();
  const timeLabel =
    stats.words < 200 ? t('lessThanMin') : t('minLabel', { minutes: stats.minutes });

  return (
    <span
      className="text-muted-foreground hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs sm:inline-flex"
      title={t('wordsTitle', { count: wordsLabel, time: timeLabel })}
      aria-label={
        stats.words === 1
          ? t('wordsAriaOne', { time: timeLabel })
          : t('wordsAriaOther', { count: wordsLabel, time: timeLabel })
      }
    >
      <Clock className="size-3" />
      {wordsLabel} <span className="text-muted-foreground/70">·</span> {timeLabel}
    </span>
  );
}

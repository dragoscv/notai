'use client';
import * as React from 'react';
import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getWritingStreak, type StreakInfo } from '@/server/actions/streak';

/**
 * Tiny streak badge: how many days in a row the user has touched at
 * least one note. Shows nothing for first-day users (no streak yet);
 * once a user has any history the badge is always visible so the
 * habit signal is consistent.
 */
export function StreakBadge() {
  const t = useTranslations('dashboard.streak');
  const [info, setInfo] = React.useState<StreakInfo | null>(null);

  React.useEffect(() => {
    void getWritingStreak()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  if (!info || info.current === 0) return null;

  const tone = info.activeToday
    ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400'
    : 'bg-muted text-muted-foreground';

  return (
    <div
      title={
        info.activeToday
          ? t('titleActive', { current: info.current, best: info.best })
          : t('titleInactive', { current: info.current, best: info.best })
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${tone}`}
    >
      <Flame className="size-3.5" />
      <span className="font-medium">{t('streakLabel', { days: info.current })}</span>
      {info.best > info.current && (
        <span className="text-muted-foreground">{t('bestLabel', { count: info.best })}</span>
      )}
    </div>
  );
}

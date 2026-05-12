'use client';

import * as React from 'react';
import { Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@notai/ui/components/card';
import { Button } from '@notai/ui/components/button';
import {
  getPurgeableSummary,
  purgeOldTrash,
  type PurgeableSummary,
} from '@/server/actions/trash-purge';

const DISMISS_KEY = 'notai:purge-nudge-dismissed-on';

/**
 * Dashboard card: \u201CYou have N notes in the trash older than 30 days.
 * Empty them?\u201D \u2014 hidden when nothing is reclaimable, and re-hidden for
 * the rest of the day after the user dismisses it.
 */
export function TrashPurgeNudge() {
  const t = useTranslations('dashboard.trashPurge');
  const [summary, setSummary] = React.useState<PurgeableSummary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [hidden, setHidden] = React.useState(true);

  React.useEffect(() => {
    const dismissedOn = (() => {
      try {
        return localStorage.getItem(DISMISS_KEY);
      } catch {
        return null;
      }
    })();
    const today = new Date().toISOString().slice(0, 10);
    if (dismissedOn === today) return;
    setHidden(false);
    void getPurgeableSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  if (hidden || !summary || summary.purgeable < 1) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const purge = async () => {
    setBusy(true);
    try {
      const { purged } = await purgeOldTrash();
      toast.success(
        purged === 1 ? t('purgedOne', { count: purged }) : t('purgedOther', { count: purged }),
      );
      setHidden(true);
    } catch (err) {
      toast.error((err as Error).message || t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="text-muted-foreground bg-muted/40 grid size-8 shrink-0 place-items-center rounded-md">
          <Trash2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">
              {t('countLine', {
                count: summary.purgeable,
                word: summary.purgeable === 1 ? t('bodyOne') : t('bodyOther'),
              })}
            </span>{' '}
            <span className="text-muted-foreground">{t('tail')}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="destructive" onClick={purge} disabled={busy}>
              {busy ? t('working') : t('emptyOld')}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t('notNow')}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="text-muted-foreground hover:text-foreground -m-1 p-1"
        >
          <X className="size-4" />
        </button>
      </CardContent>
    </Card>
  );
}

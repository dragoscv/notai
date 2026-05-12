'use client';
import * as React from 'react';
import { Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  autoArchiveStale,
  unarchiveMany,
  countStaleArchivable,
} from '@/server/actions/auto-archive';

/**
 * Dashboard nudge: when there are notes untouched for 90+ days, offer
 * to bulk-archive them. Hidden when the count is zero. The Undo
 * toast restores everything via `unarchiveMany`.
 */
export function AutoArchiveNudge() {
  const t = useTranslations('dashboard.autoArchive');
  const [count, setCount] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void countStaleArchivable()
      .then(setCount)
      .catch(() => setCount(0));
  }, []);

  if (!count || count === 0) return null;

  const run = async () => {
    setBusy(true);
    try {
      const { archived, archivedIds } = await autoArchiveStale();
      setCount(0);
      toast.success(
        archived === 1
          ? t('archivedToastOne', { count: archived })
          : t('archivedToastOther', { count: archived }),
        {
          action: {
            label: t('undo'),
            onClick: () => {
              void unarchiveMany(archivedIds)
                .then(() => toast.message(t('undoToast')))
                .catch((err: unknown) => toast.error((err as Error).message));
            },
          },
        },
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card flex items-center gap-3 rounded-2xl border p-3">
      <Archive className="text-muted-foreground size-4" />
      <div className="flex-1 text-sm">
        <span className="font-medium">{count}</span>{' '}
        <span className="text-muted-foreground">{count === 1 ? t('bodyOne') : t('bodyOther')}</span>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t('archiving') : t('archiveAll')}
      </button>
    </div>
  );
}

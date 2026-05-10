'use client';
import * as React from 'react';
import { Archive } from 'lucide-react';
import { toast } from 'sonner';
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
      toast.success(`Archived ${archived} stale note${archived === 1 ? '' : 's'}.`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void unarchiveMany(archivedIds)
              .then(() => toast.message('Archive undone.'))
              .catch((err: unknown) => toast.error((err as Error).message));
          },
        },
      });
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
        <span className="text-muted-foreground">
          note{count === 1 ? '' : 's'} untouched for 90+ days.
        </span>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Archiving\u2026' : 'Archive all'}
      </button>
    </div>
  );
}

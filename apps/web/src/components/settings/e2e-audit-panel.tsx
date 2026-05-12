'use client';
import * as React from 'react';
import { History, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { listMyE2eAudit, type E2eAuditRow } from '@/server/actions/e2e-audit';

export function E2eAuditPanel() {
  const t = useTranslations('settings.e2eAudit');
  const eventLabel: Record<E2eAuditRow['event'], string> = {
    setup: t('eventSetup'),
    rotate: t('eventRotate'),
    note_lock: t('eventNoteLock'),
    note_unlock: t('eventNoteUnlock'),
    note_disable: t('eventNoteDisable'),
    recovery_unlock: t('eventRecoveryUnlock'),
  };

  function formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (diff < 60_000) return t('relJustNow');
    if (diff < 3_600_000) return t('relMinutes', { n: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('relHours', { n: Math.floor(diff / 3_600_000) });
    if (diff < 604_800_000) return t('relDays', { n: Math.floor(diff / 86_400_000) });
    return new Date(iso).toLocaleDateString();
  }

  const [rows, setRows] = React.useState<E2eAuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMyE2eAudit());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="bg-card/60 rounded-xl border p-4 backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4" /> {t('title')}
          </p>
          <p className="text-muted-foreground text-xs">{t('description')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">{loading ? t('loading') : t('empty')}</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 border-b border-dashed py-1 last:border-0"
            >
              <span className="truncate">
                <span className="font-medium">{eventLabel[r.event] ?? r.event}</span>
                {r.noteId ? (
                  <span className="text-muted-foreground"> · note {r.noteId.slice(0, 8)}</span>
                ) : null}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatRelative(r.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

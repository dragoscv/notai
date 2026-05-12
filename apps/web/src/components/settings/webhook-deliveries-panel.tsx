'use client';

import * as React from 'react';
import { RefreshCw, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { listWebhookDeliveries, redeliverWebhook } from '@/server/actions/webhooks';

interface DeliveryView {
  id: string;
  event: string;
  statusCode: number | null;
  deliveredAt: string;
  durationMs: number | null;
  responseBody: string | null;
}

export function WebhookDeliveriesPanel({
  endpointId,
  initial,
}: {
  endpointId: string;
  initial: DeliveryView[];
}) {
  const t = useTranslations('settings.deliveries');
  const [rows, setRows] = React.useState<DeliveryView[]>(initial);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await listWebhookDeliveries(endpointId);
      setRows(
        next.map((d) => ({
          ...d,
          deliveredAt: d.deliveredAt.toISOString(),
        })),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const replay = async (id: string) => {
    setBusy(id);
    try {
      const out = await redeliverWebhook(id);
      toast.success(t('replayedWithStatus', { status: out.statusCode ?? t('noResponse') }));
      await refresh();
    } catch (err) {
      toast.error((err as Error).message ?? t('replayFailed'));
    } finally {
      setBusy(null);
    }
  };

  // p95 latency over the last 50 attempts.
  const p95 = React.useMemo(() => {
    const xs = rows.map((r) => r.durationMs).filter((x): x is number => x != null);
    if (xs.length === 0) return null;
    xs.sort((a, b) => a - b);
    const idx = Math.min(xs.length - 1, Math.floor(xs.length * 0.95));
    return xs[idx];
  }, [rows]);
  const successRate = React.useMemo(() => {
    if (rows.length === 0) return null;
    const ok = rows.filter(
      (r) => r.statusCode != null && r.statusCode >= 200 && r.statusCode < 300,
    ).length;
    return Math.round((ok / rows.length) * 100);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Stat label={t('recent')} value={String(rows.length)} />
        <Stat label={t('successRate')} value={successRate == null ? '—' : `${successRate}%`} />
        <Stat label={t('p95')} value={p95 == null ? '—' : `${p95} ms`} />
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="hover:bg-muted ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        >
          <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} /> {t('refresh')}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t('empty')}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((d) => {
            const ok = d.statusCode != null && d.statusCode >= 200 && d.statusCode < 300;
            return (
              <li key={d.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span
                  className={`mt-0.5 inline-flex h-5 min-w-[2.5rem] items-center justify-center rounded px-1 font-mono text-[11px] ${
                    ok
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                >
                  {d.statusCode ?? 'ERR'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{d.event}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(d.deliveredAt).toLocaleString()}
                    </span>
                    {d.durationMs != null && (
                      <span className="text-muted-foreground text-xs">{d.durationMs} ms</span>
                    )}
                  </div>
                  {d.responseBody && (
                    <pre className="text-muted-foreground mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[11px]">
                      {d.responseBody.slice(0, 500)}
                    </pre>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void replay(d.id)}
                  disabled={busy === d.id}
                  className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                  title={t('refireTitle')}
                >
                  <Repeat className={`size-3 ${busy === d.id ? 'animate-spin' : ''}`} />{' '}
                  {t('replay')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Copy,
  Loader2,
  Activity,
  RefreshCw,
  BarChart3,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Switch } from '@notai/ui/components/switch';
import {
  createWebhook,
  deleteWebhook,
  setWebhookActive,
  listWebhookDeliveries,
  redeliverWebhook,
  rotateWebhookSecret,
  WEBHOOK_EVENTS,
  type DeliveryRow,
} from '@/server/actions/webhooks';

const DEFAULT_EVENTS: ReadonlyArray<(typeof WEBHOOK_EVENTS)[number]> = [
  'note.created',
  'note.updated',
  'note.archived',
];

export interface SerializedHook {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
}

export function WebhookManager({ initial }: { initial: SerializedHook[] }) {
  const t = useTranslations('settings.webhooks');
  const [hooks, setHooks] = React.useState(initial);
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = React.useState<Set<string>>(
    () => new Set(DEFAULT_EVENTS),
  );

  const toggleEvent = (name: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      const events =
        selectedEvents.size > 0
          ? WEBHOOK_EVENTS.filter((ev) => selectedEvents.has(ev)).join(' ')
          : DEFAULT_EVENTS.join(' ');
      const res = await createWebhook({ url: url.trim(), events });
      setFreshSecret(res.secret);
      setHooks((rows) => [
        ...rows,
        {
          id: res.id,
          url: url.trim(),
          events,
          isActive: true,
          createdAt: new Date().toISOString(),
          lastSuccessAt: null,
          lastFailureAt: null,
          failureCount: 0,
        },
      ]);
      setUrl('');
      setSelectedEvents(new Set(DEFAULT_EVENTS));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('couldNotCreate'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {freshSecret && (
        <div className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
          <p className="text-sm font-medium">{t('secretCopyTitle')}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('secretCopyHelpPrefix')} <code>X-Notai-Signature</code> {t('secretCopyHelpSuffix')}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="bg-background flex-1 truncate rounded-md border px-2 py-1.5 text-xs">
              {freshSecret}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(freshSecret);
                toast.success(t('copied'));
              }}
            >
              <Copy className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFreshSecret(null)}>
              {t('done')}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onCreate} className="bg-card flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2048}
            placeholder={t('urlPlaceholder')}
            className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={busy || !url.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t('add')}
          </Button>
        </div>
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer select-none text-xs">
            {t('events.toggle', {
              count: selectedEvents.size,
              total: WEBHOOK_EVENTS.length,
            })}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((ev) => (
              <label
                key={ev}
                className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.has(ev)}
                  onChange={() => toggleEvent(ev)}
                  className="size-3.5"
                />
                <span className="font-mono text-[11px]">{ev}</span>
                <span className="text-muted-foreground ml-1 truncate">
                  {t(`events.${ev}` as 'events.note.created')}
                </span>
              </label>
            ))}
          </div>
        </details>
      </form>

      {hooks.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('empty')}</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {hooks.map((h) => (
            <HookRow
              key={h.id}
              hook={h}
              onToggle={async (next) => {
                try {
                  await setWebhookActive({ id: h.id, active: next });
                  setHooks((rows) =>
                    rows.map((r) => (r.id === h.id ? { ...r, isActive: next } : r)),
                  );
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('failed'));
                }
              }}
              onDelete={async () => {
                if (!window.confirm(t('confirmDelete'))) return;
                try {
                  await deleteWebhook(h.id);
                  setHooks((rows) => rows.filter((r) => r.id !== h.id));
                  toast.success(t('deleted'));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('failed'));
                }
              }}
              onRotate={async () => {
                if (!window.confirm(t('confirmRotate'))) return;
                try {
                  const r = await rotateWebhookSecret(h.id);
                  setFreshSecret(r.secret);
                  toast.success(t('rotated'));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('failed'));
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HookRow({
  hook,
  onToggle,
  onDelete,
  onRotate,
}: {
  hook: SerializedHook;
  onToggle: (next: boolean) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onRotate: () => void | Promise<void>;
}) {
  const t = useTranslations('settings.webhooks');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<DeliveryRow[] | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWebhookDeliveries(hook.id);
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }, [hook.id]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null) await refresh();
  };

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{hook.url}</div>
          <div className="text-muted-foreground text-xs">
            {hook.events}
            {hook.lastSuccessAt
              ? ` \u00b7 ${t('okPrefix')} ${new Date(hook.lastSuccessAt).toLocaleString()}`
              : ''}
            {hook.failureCount > 0
              ? ` \u00b7 ${hook.failureCount === 1 ? t('failuresOne', { count: hook.failureCount }) : t('failuresOther', { count: hook.failureCount })}`
              : ''}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleOpen}
          aria-expanded={open}
          title={t('viewDeliveriesTitle')}
        >
          <Activity className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" asChild title={t('openDashboardTitle')}>
          <Link href={`/app/settings/webhooks/${hook.id}`}>
            <BarChart3 className="size-4" />
          </Link>
        </Button>
        <Switch checked={hook.isActive} onCheckedChange={onToggle} />
        <Button size="sm" variant="ghost" onClick={onRotate} title={t('rotateTitle')}>
          <KeyRound className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open && (
        <div className="bg-muted/20 border-t px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              {t('recentDeliveries')}
            </span>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t('refresh')}
            </Button>
          </div>
          {rows === null ? (
            <p className="text-muted-foreground text-xs">{t('loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('noDeliveries')}</p>
          ) : (
            <ul className="bg-background divide-y rounded-lg border">
              {rows.map((d) => {
                const ok = d.statusCode != null && d.statusCode >= 200 && d.statusCode < 300;
                return (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span
                      className={`inline-block w-12 rounded px-1.5 py-0.5 text-center font-mono ${
                        ok
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/15 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {d.statusCode ?? 'err'}
                    </span>
                    <span className="font-mono">{d.event}</span>
                    <span className="text-muted-foreground">
                      {new Date(d.deliveredAt).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {d.durationMs != null ? `${d.durationMs} ms` : ''}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const r = await redeliverWebhook(d.id);
                          toast.success(
                            r.statusCode
                              ? t('redeliveredHttp', { code: r.statusCode })
                              : t('redeliveredNoResponse'),
                          );
                          await refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : t('failed'));
                        }
                      }}
                    >
                      <RefreshCw className="size-3" />
                      {t('resend')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

'use client';

import * as React from 'react';
import { Plus, Trash2, Copy, Loader2, Activity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Switch } from '@notai/ui/components/switch';
import {
  createWebhook,
  deleteWebhook,
  setWebhookActive,
  listWebhookDeliveries,
  redeliverWebhook,
  type DeliveryRow,
} from '@/server/actions/webhooks';

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
  const [hooks, setHooks] = React.useState(initial);
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await createWebhook({ url: url.trim() });
      setFreshSecret(res.secret);
      setHooks((rows) => [
        ...rows,
        {
          id: res.id,
          url: url.trim(),
          events: 'note.created note.updated note.archived',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastSuccessAt: null,
          lastFailureAt: null,
          failureCount: 0,
        },
      ]);
      setUrl('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {freshSecret && (
        <div className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
          <p className="text-sm font-medium">Copy your signing secret now.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Use this to verify the <code>X-Notai-Signature</code> header on incoming requests. We
            won\u2019t show it again.
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
                toast.success('Copied');
              }}
            >
              <Copy className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFreshSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onCreate} className="bg-card flex items-center gap-2 rounded-2xl border p-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2048}
          placeholder="https://your-server.example.com/notai-webhook"
          className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || !url.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>

      {hooks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No webhooks yet.</p>
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
                  toast.error(err instanceof Error ? err.message : 'Failed');
                }
              }}
              onDelete={async () => {
                if (!window.confirm('Delete this webhook?')) return;
                try {
                  await deleteWebhook(h.id);
                  setHooks((rows) => rows.filter((r) => r.id !== h.id));
                  toast.success('Deleted');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed');
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
}: {
  hook: SerializedHook;
  onToggle: (next: boolean) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<DeliveryRow[] | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWebhookDeliveries(hook.id);
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load');
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
              ? ` \u00b7 ok ${new Date(hook.lastSuccessAt).toLocaleString()}`
              : ''}
            {hook.failureCount > 0 ? ` \u00b7 ${hook.failureCount} failure(s)` : ''}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleOpen}
          aria-expanded={open}
          title="View deliveries"
        >
          <Activity className="size-4" />
        </Button>
        <Switch checked={hook.isActive} onCheckedChange={onToggle} />
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open && (
        <div className="bg-muted/20 border-t px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">Recent deliveries</span>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </Button>
          </div>
          {rows === null ? (
            <p className="text-muted-foreground text-xs">Loading\u2026</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">No deliveries yet.</p>
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
                              ? `Re-delivered (HTTP ${r.statusCode})`
                              : 'Re-delivered (no response)',
                          );
                          await refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed');
                        }
                      }}
                    >
                      <RefreshCw className="size-3" />
                      Resend
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

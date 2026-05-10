'use client';

import * as React from 'react';
import { Plus, Trash2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Switch } from '@notai/ui/components/switch';
import { createWebhook, deleteWebhook, setWebhookActive } from '@/server/actions/webhooks';

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
            <li key={h.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.url}</div>
                <div className="text-muted-foreground text-xs">
                  {h.events}
                  {h.lastSuccessAt
                    ? ` \u00b7 ok ${new Date(h.lastSuccessAt).toLocaleString()}`
                    : ''}
                  {h.failureCount > 0 ? ` \u00b7 ${h.failureCount} failure(s)` : ''}
                </div>
              </div>
              <Switch
                checked={h.isActive}
                onCheckedChange={async (next) => {
                  try {
                    await setWebhookActive({ id: h.id, active: next });
                    setHooks((rows) =>
                      rows.map((r) => (r.id === h.id ? { ...r, isActive: next } : r)),
                    );
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed');
                  }
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm('Delete this webhook?')) return;
                  try {
                    await deleteWebhook(h.id);
                    setHooks((rows) => rows.filter((r) => r.id !== h.id));
                    toast.success('Deleted');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed');
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

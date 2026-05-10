'use client';

import * as React from 'react';
import { Trash2, Plus, Copy, Loader2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { createApiKey, revokeApiKey } from '@/server/actions/api-keys';
import { getApiKeyUsage, type ApiKeyUsageStats } from '@/server/actions/api-usage';

export interface SerializedKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export function ApiKeyManager({ initial }: { initial: SerializedKey[] }) {
  const [keys, setKeys] = React.useState(initial);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [freshKey, setFreshKey] = React.useState<string | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await createApiKey({ name: name.trim() });
      setFreshKey(res.key);
      setKeys((rows) => [
        ...rows,
        {
          id: res.id,
          name: name.trim(),
          prefix: res.prefix,
          scopes: 'notes:read notes:write',
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          expiresAt: null,
        },
      ]);
      setName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {freshKey && (
        <div className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
          <p className="text-sm font-medium">Copy your new key now.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            We won\u2019t show it again. Store it in a password manager.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="bg-background flex-1 truncate rounded-md border px-2 py-1.5 text-xs">
              {freshKey}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(freshKey);
                toast.success('Copied');
              }}
            >
              <Copy className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFreshKey(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onCreate} className="bg-card flex items-center gap-2 rounded-2xl border p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Key name (e.g. \u201cZapier\u201d)"
          className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create
        </Button>
      </form>

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No keys yet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {keys.map((k) => (
            <KeyRow
              key={k.id}
              k={k}
              onRevoked={() => setKeys((rows) => rows.filter((r) => r.id !== k.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyRow({ k, onRevoked }: { k: SerializedKey; onRevoked: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [stats, setStats] = React.useState<ApiKeyUsageStats | null>(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!open || stats) return;
    setLoading(true);
    getApiKeyUsage(k.id)
      .then((s) => setStats(s))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open, stats, k.id]);
  return (
    <li className="p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{k.name}</div>
          <div className="text-muted-foreground font-mono text-xs">{k.prefix}\u2026</div>
          <div className="text-muted-foreground mt-1 text-xs">
            {k.scopes} \u00b7 created {new Date(k.createdAt).toLocaleDateString()}
            {k.lastUsedAt
              ? ` \u00b7 last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
              : ' \u00b7 unused'}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} title="Usage">
          <Activity className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (
              !window.confirm(
                `Revoke \u201c${k.name}\u201d? Calls using it will start failing immediately.`,
              )
            )
              return;
            try {
              await revokeApiKey(k.id);
              onRevoked();
              toast.success('Revoked');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed');
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open && (
        <div className="bg-muted/40 mt-3 rounded-lg p-3 text-xs">
          {loading && <p className="text-muted-foreground">Loading\u2026</p>}
          {!loading && stats && (
            <>
              <div className="mb-2">
                <span className="font-medium">{stats.totalLast30Days}</span> request
                {stats.totalLast30Days === 1 ? '' : 's'} in last 30 days
                {stats.errorsLast30Days > 0 && (
                  <span className="text-destructive">
                    {' '}
                    \u00b7 {stats.errorsLast30Days} error(s)
                  </span>
                )}
              </div>
              {stats.recent.length === 0 ? (
                <p className="text-muted-foreground">No calls yet.</p>
              ) : (
                <ul className="space-y-0.5 font-mono">
                  {stats.recent.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span
                        className={
                          r.status >= 400
                            ? 'text-destructive w-10'
                            : r.status >= 300
                              ? 'w-10 text-amber-600'
                              : 'w-10 text-emerald-600'
                        }
                      >
                        {r.status}
                      </span>
                      <span className="w-12">{r.method}</span>
                      <span className="flex-1 truncate">{r.path}</span>
                      <span className="text-muted-foreground w-12 text-right">
                        {r.durationMs}ms
                      </span>
                      <span className="text-muted-foreground w-32 text-right">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

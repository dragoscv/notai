'use client';

import * as React from 'react';

interface Probe {
  name: string;
  description: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

interface StatusResponse {
  status: 'operational' | 'degraded' | 'down';
  version: string;
  uptimeSec: number;
  at: string;
  probes: Probe[];
}

const REFRESH_MS = 30_000;

export function StatusBoard() {
  const [data, setData] = React.useState<StatusResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const json = (await res.json()) as StatusResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  if (loading && !data) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
        Could not reach the status API: {error}
      </div>
    );
  }
  if (!data) return null;

  const banner =
    data.status === 'operational'
      ? { tone: 'ok', label: 'All systems operational' }
      : data.status === 'degraded'
        ? { tone: 'warn', label: 'Some systems degraded' }
        : { tone: 'down', label: 'Major outage' };

  return (
    <section className="space-y-6">
      <div
        className={[
          'flex items-center justify-between rounded-2xl border p-5',
          banner.tone === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : banner.tone === 'warn'
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-red-500/40 bg-red-500/5',
        ].join(' ')}
      >
        <div className="flex items-center gap-3">
          <span
            className={[
              'inline-block size-3 rounded-full',
              banner.tone === 'ok'
                ? 'bg-emerald-500'
                : banner.tone === 'warn'
                  ? 'bg-amber-500'
                  : 'bg-red-500',
            ].join(' ')}
            aria-hidden
          />
          <span className="text-base font-medium">{banner.label}</span>
        </div>
        <span className="text-muted-foreground text-xs">
          Updated {new Date(data.at).toLocaleTimeString()}
        </span>
      </div>

      <ul className="divide-y rounded-2xl border">
        {data.probes.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.description}</p>
              {p.detail && !p.ok && (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{p.detail}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-xs">{p.latencyMs} ms</span>
              <span
                className={[
                  'inline-block size-2.5 rounded-full',
                  p.ok ? 'bg-emerald-500' : 'bg-red-500',
                ].join(' ')}
                aria-label={p.ok ? 'operational' : 'down'}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">
        Build {data.version} · uptime {Math.round(data.uptimeSec / 60)} min on this instance
      </p>
    </section>
  );
}

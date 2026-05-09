'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@notai/ui';

const TIERS = ['all', 'free', 'pro', 'teams'] as const;
const STATUSES = ['all', 'active', 'suspended', 'deleted'] as const;

export function UsersFilters({
  initialQuery,
  initialTier,
  initialStatus,
}: {
  initialQuery: string;
  initialTier: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = React.useState(initialQuery);
  const [tier, setTier] = React.useState(initialTier);
  const [status, setStatus] = React.useState(initialStatus);

  const update = React.useCallback(
    (next: { q?: string; tier?: string; status?: string }) => {
      const params = new URLSearchParams();
      const v = { q, tier, status, ...next };
      if (v.q) params.set('q', v.q);
      if (v.tier && v.tier !== 'all') params.set('tier', v.tier);
      if (v.status && v.status !== 'all') params.set('status', v.status);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [q, tier, status, pathname, router],
  );

  React.useEffect(() => {
    const t = setTimeout(() => update({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-sm flex-1">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email or name…"
          className="pl-8"
        />
      </div>
      <select
        value={tier}
        onChange={(e) => {
          setTier(e.target.value);
          update({ tier: e.target.value });
        }}
        className="border-input bg-background h-9 rounded-md border px-2.5 text-sm"
      >
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t === 'all' ? 'All plans' : t}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          update({ status: e.target.value });
        }}
        className="border-input bg-background h-9 rounded-md border px-2.5 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === 'all' ? 'Any status' : s}
          </option>
        ))}
      </select>
    </div>
  );
}

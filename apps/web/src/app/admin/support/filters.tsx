'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@notai/ui';

const STATUSES = ['all', 'open', 'pending', 'resolved', 'closed'] as const;

export function TicketsFilters({
  initialStatus,
  initialQuery,
}: {
  initialStatus: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(initialQuery);

  const apply = React.useCallback(
    (next: Record<string, string | undefined>) => {
      const url = new URLSearchParams(params?.toString() ?? '');
      url.delete('page');
      for (const [k, v] of Object.entries(next)) {
        if (v && v !== 'all') url.set(k, v);
        else url.delete(k);
      }
      router.replace(`/admin/support?${url.toString()}`);
    },
    [params, router],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="bg-muted/40 inline-flex rounded-md p-0.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => apply({ status: s })}
            className={
              'rounded px-2.5 py-1 text-xs font-medium uppercase tracking-wider transition ' +
              (initialStatus === s
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="flex flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject, email, or reference…"
          className="h-8 max-w-md text-xs"
        />
      </form>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@notai/ui/components/tooltip';
import { getEmbedBacklog } from '@/server/actions/embed-status';

const POLL_MS = 30_000;

/**
 * Tiny status pill: appears only while the embedding worker is behind.
 * Polls every 30s while pending > 0; pauses polling once caught up so
 * we don\u2019t hammer the DB on a quiet account.
 */
export function EmbedStatusIndicator() {
  const [pending, setPending] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const r = await getEmbedBacklog();
        if (cancelled) return;
        setPending(r.pending);
        if (r.pending > 0) timer = setTimeout(tick, POLL_MS);
      } catch {
        // Silent: this is best-effort UI candy.
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!pending || pending < 1) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-muted-foreground bg-muted/40 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
          aria-label={`${pending} notes indexing`}
        >
          <Loader2 className="size-3 animate-spin" />
          <Sparkles className="size-3" />
          {pending}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Indexing {pending} note{pending === 1 ? '' : 's'} for AI search \u2014 Related notes & Ask
        will catch up shortly.
      </TooltipContent>
    </Tooltip>
  );
}

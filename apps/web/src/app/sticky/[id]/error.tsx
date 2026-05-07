'use client';

import { RefreshCw } from 'lucide-react';

/**
 * Error boundary for /sticky/[id]. Without this, a server error renders a
 * completely blank page inside the Tauri webview. Branded to match the rest
 * of the app — warm card, subtle aurora, gentle copy.
 */
export default function StickyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-background text-foreground relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/15 absolute -left-20 -top-20 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-destructive/10 absolute -right-20 bottom-0 h-72 w-72 rounded-full blur-3xl" />
      </div>

      <div className="bg-card/90 text-card-foreground shadow-foreground/10 w-full max-w-sm space-y-3 rounded-xl border p-5 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-destructive size-2 rounded-full" />
          <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            sticky error
          </span>
        </div>

        <h2 className="font-serif text-xl font-semibold tracking-tight">
          Sticky couldn&apos;t load
        </h2>
        <p className="text-muted-foreground text-sm">{error.message || 'Unknown error'}</p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-[11px]">ref: {error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm shadow-sm transition-colors"
        >
          <RefreshCw className="size-3.5" /> Retry
        </button>
      </div>
    </div>
  );
}

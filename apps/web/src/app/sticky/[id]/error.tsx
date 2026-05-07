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
        <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background p-4 text-foreground">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
                <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-destructive/10 blur-3xl" />
            </div>

            <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card/90 p-5 text-card-foreground shadow-xl shadow-foreground/10 backdrop-blur">
                <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-destructive" />
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        sticky error
                    </span>
                </div>

                <h2 className="font-serif text-xl font-semibold tracking-tight">
                    Sticky couldn&apos;t load
                </h2>
                <p className="text-sm text-muted-foreground">{error.message || 'Unknown error'}</p>
                {error.digest && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                        ref: {error.digest}
                    </p>
                )}

                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <RefreshCw className="size-3.5" /> Retry
                </button>
            </div>
        </div>
    );
}

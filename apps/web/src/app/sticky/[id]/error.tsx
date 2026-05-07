'use client';
/**
 * Error boundary for /sticky/[id]. Without this, a server error renders a
 * completely blank page inside the Tauri webview.
 */
export default function StickyError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="grid min-h-dvh place-items-center p-4 text-sm">
            <div className="max-w-sm space-y-3 rounded-md border bg-card p-4 text-card-foreground shadow">
                <h2 className="font-semibold">Sticky couldn&apos;t load</h2>
                <p className="text-muted-foreground">{error.message || 'Unknown error'}</p>
                {error.digest && (
                    <p className="font-mono text-xs text-muted-foreground">digest: {error.digest}</p>
                )}
                <button
                    type="button"
                    onClick={reset}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                    Retry
                </button>
            </div>
        </div>
    );
}

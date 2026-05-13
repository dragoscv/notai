/**
 * Generic skeleton inherited by every sub-route under /app that does not
 * provide its own loading.tsx. Replaces the blank screen during server
 * action waits (note hydration, list queries, redirects) with a calm,
 * paper-toned placeholder that matches the editor's visual rhythm.
 */
export default function AppLoading() {
  return (
    <div className="min-h-full w-full px-4 py-8 sm:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <div className="bg-muted/70 h-3 w-24 animate-pulse rounded" />
          <div className="bg-muted h-7 w-2/3 animate-pulse rounded" />
          <div className="bg-muted/60 h-4 w-1/2 animate-pulse rounded" />
        </div>
        <div className="space-y-2.5 pt-4">
          <div className="bg-muted/70 h-3 w-full animate-pulse rounded" />
          <div className="bg-muted/70 h-3 w-[92%] animate-pulse rounded" />
          <div className="bg-muted/70 h-3 w-[85%] animate-pulse rounded" />
          <div className="bg-muted/70 h-3 w-[70%] animate-pulse rounded" />
        </div>
        <div className="space-y-2.5 pt-2">
          <div className="bg-muted/70 h-3 w-[88%] animate-pulse rounded" />
          <div className="bg-muted/70 h-3 w-[60%] animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}

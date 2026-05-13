/**
 * Loading state for the graph route. The note graph needs the full
 * dataset before nodes can be laid out, so during the await we show a
 * subtle pulse where the canvas will mount instead of a blank screen.
 */
export default function GraphLoading() {
  return (
    <div className="flex h-full w-full flex-col" aria-busy="true" aria-live="polite">
      <div className="border-border/60 flex items-center justify-between border-b px-6 py-4">
        <div className="space-y-2">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          <div className="bg-muted/70 h-3 w-48 animate-pulse rounded" />
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative size-40">
            <div className="bg-muted/30 absolute inset-0 animate-pulse rounded-full" />
            <div className="bg-muted/40 absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

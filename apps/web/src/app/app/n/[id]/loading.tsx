/**
 * Loading state for the editor page. Mimics the toolbar + canvas chrome
 * so the user sees the layout settle rather than a generic body skeleton.
 */
export default function NoteEditorLoading() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-live="polite">
      <div className="border-border/60 flex h-12 items-center gap-2 border-b px-3">
        <div className="bg-muted h-6 w-32 animate-pulse rounded" />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="bg-muted/70 h-7 w-7 animate-pulse rounded" />
          <div className="bg-muted/70 h-7 w-7 animate-pulse rounded" />
          <div className="bg-muted/70 h-7 w-20 animate-pulse rounded" />
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid place-items-center">
          <div className="bg-muted/40 h-2 w-32 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}

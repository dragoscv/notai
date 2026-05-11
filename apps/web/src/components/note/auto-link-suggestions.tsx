'use client';
import * as React from 'react';
import { Link2, X } from 'lucide-react';
import { toast } from 'sonner';
import { suggestAutoLinks, type AutoLinkSuggestion } from '@/server/actions/auto-link';

interface Props {
  noteId: string;
  /** Optional callback: when the user clicks "Insert link", this is
   *  invoked with the suggested note's title + id. The host can use
   *  it to write `[[Title]]` into the canvas. If omitted, the chip
   *  just shows a "Copy [[Title]]" affordance instead. */
  onInsertLink?: (title: string, id: string) => void;
}

/**
 * Surface 0–4 strong semantic neighbours that this note doesn't yet
 * mention by title. Lets the user one-click insert a `[[Title]]`
 * backlink (or copy it to the clipboard when no insertion hook is
 * provided). Auto-refreshes on note change. Hidden when the embedding
 * worker is behind or there's nothing strong to suggest.
 */
export function AutoLinkSuggestions({ noteId, onInsertLink }: Props) {
  const [items, setItems] = React.useState<AutoLinkSuggestion[] | null>(null);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    setDismissed(new Set());
    void suggestAutoLinks(noteId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const visible = (items ?? []).filter((it) => !dismissed.has(it.id));
  if (!items || visible.length === 0) return null;

  const insert = (it: AutoLinkSuggestion) => {
    const title = (it.title ?? '').trim() || 'Untitled';
    if (onInsertLink) {
      onInsertLink(title, it.id);
      toast.success(`Linked to "${title}"`);
    } else {
      const text = `[[${title}]]`;
      void navigator.clipboard?.writeText(text);
      toast.success(`Copied ${text}`);
    }
    setDismissed((s) => new Set([...s, it.id]));
  };

  return (
    <div className="border-t px-4 py-3 md:px-6">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <Link2 className="size-3.5" />
        <span>Suggested links</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((it) => (
          <div
            key={it.id}
            className="bg-card group flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs"
            title={`Similarity ${(1 - it.distance).toFixed(2)}`}
          >
            <button
              type="button"
              onClick={() => insert(it)}
              className="hover:text-amber-600 dark:hover:text-amber-400"
            >
              <span className="mr-1">{it.icon || '🔗'}</span>
              <span className="max-w-[14rem] truncate align-middle">{it.title || 'Untitled'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed((s) => new Set([...s, it.id]))}
              className="text-muted-foreground hover:text-foreground ml-1 opacity-0 transition focus:opacity-100 group-hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

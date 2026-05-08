'use client';
import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Link2 } from 'lucide-react';
import { listIncomingBacklinks } from '@/server/actions/backlinks';

interface Hit {
  id: string;
  title: string;
}

/**
 * Footer panel under each note showing other notes that link to it.
 * Lazy-loads when expanded to avoid a query on every page open.
 */
export function BacklinksPanel({ noteId }: { noteId: string }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Hit[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    if (items != null) return;
    setLoading(true);
    listIncomingBacklinks(noteId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [items, noteId]);

  return (
    <details
      className="border-border/60 mx-auto w-full max-w-[var(--editor-max-width,720px)] border-t px-4 py-2"
      open={open}
      onToggle={(e) => {
        const isOpen = (e.target as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen) load();
      }}
    >
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 text-xs font-medium uppercase tracking-wide">
        <Link2 className="size-3.5" />
        Backlinks
      </summary>
      <div className="mt-3">
        {loading && <p className="text-muted-foreground text-sm">Looking…</p>}
        {!loading && items && items.length === 0 && (
          <p className="text-muted-foreground text-sm">No notes link here yet.</p>
        )}
        {items && items.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/app/n/${it.id}`}
                  className="text-foreground/85 hover:text-primary hover:bg-primary/5 group inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm"
                >
                  <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100" />
                  {it.title || 'Untitled'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

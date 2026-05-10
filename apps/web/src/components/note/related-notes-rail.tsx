'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sparkles, FileText } from 'lucide-react';
import { getRelatedNotes, type RelatedNote } from '@/server/actions/related-notes';

interface Props {
  noteId: string;
}

/**
 * Horizontal rail of semantically related notes for the current note.
 * Powered by pgvector cosine similarity over `notes.embedding`. Hidden
 * when there are no embedded neighbours yet (e.g. the worker hasn't
 * caught up on a fresh note) or when nothing crosses the relevance
 * threshold.
 */
export function RelatedNotesRail({ noteId }: Props) {
  const [items, setItems] = React.useState<RelatedNote[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void getRelatedNotes(noteId)
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
  if (!items || items.length === 0) return null;
  return (
    <div className="border-t px-4 py-3 md:px-6">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <Sparkles className="size-3.5" />
        <span>Related notes</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/app/n/${it.id}`}
            className="bg-card hover:bg-muted flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
            title={`Distance ${it.distance.toFixed(3)}`}
          >
            <span className="size-3.5 text-center">
              {it.icon || <FileText className="size-3 opacity-60" />}
            </span>
            <span className="max-w-[14rem] truncate">{it.title || 'Untitled'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

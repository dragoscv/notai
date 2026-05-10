'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@notai/ui/components/dialog';
import { Input } from '@notai/ui/components/input';
import { Button } from '@notai/ui/components/button';
import { searchNotes, type SearchHit } from '@/server/actions/search';
import { mergeNotes } from '@/server/actions/merge-notes';
import { restoreNote } from '@/server/actions/notes';
import type { Note } from '@notai/db/schema';

/**
 * Pick a target note and merge the source into it. The source is
 * soft-deleted, the target opens with the source's content queued in
 * `notai:pending-append` for the workspace to drain.
 */
export function NoteMergeDialog({
  source,
  open,
  onOpenChange,
}: {
  source: Note;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchNotes(q)
        .then((rows) => {
          if (!cancelled) setHits(rows.filter((h) => h.id !== source.id).slice(0, 8));
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, source.id]);

  const merge = async (targetId: string) => {
    setBusy(targetId);
    const t = toast.loading('Merging…');
    try {
      const res = await mergeNotes({ sourceId: source.id, targetId });
      try {
        window.localStorage.setItem(
          'notai:pending-append',
          // eslint-disable-next-line react-hooks/purity
          JSON.stringify({ noteId: res.targetId, text: res.appendText, ts: Date.now() }),
        );
      } catch {
        /* ignore */
      }
      toast.success(`Merged "${res.sourceTitle}" into target.`, {
        id: t,
        action: {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              try {
                await restoreNote(source.id);
                toast.success(`Restored "${res.sourceTitle}"`);
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Could not undo merge');
              }
            })();
          },
        },
        duration: 8000,
      });
      onOpenChange(false);
      router.push(`/app/n/${targetId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Merge failed', { id: t });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" /> Merge into another note
          </DialogTitle>
          <DialogDescription>
            Append &ldquo;{source.title || 'Untitled'}&rdquo; to a target note. The source will be
            moved to Trash.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Find target note\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {searching && (
            <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs">
              <Loader2 className="size-3 animate-spin" /> Searching\u2026
            </div>
          )}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => merge(h.id)}
              disabled={busy !== null}
              className="hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left disabled:opacity-50"
            >
              <span className="text-base">{h.icon ?? '\u{1F4DD}'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.title || 'Untitled'}</p>
                {h.snippet && <p className="text-muted-foreground truncate text-xs">{h.snippet}</p>}
              </div>
              {busy === h.id && <Loader2 className="size-3.5 animate-spin" />}
            </button>
          ))}
          {!searching && query.trim().length >= 2 && hits.length === 0 && (
            <p className="text-muted-foreground px-2 py-2 text-xs">No matches.</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';
import * as React from 'react';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import * as Y from 'yjs';
import { migrateBlocksToExcalidraw, useBlocksCount } from '@notai/editor';
import { rewireCommentsAfterMigration } from '@/server/actions/comments';

interface CanvasMigrationBannerProps {
  noteId: string;
  doc: Y.Doc | null;
}

/**
 * Phase-3 of the Excalidraw migration: a dismissible nudge shown on
 * every note that still has TipTap text blocks. Clicking "Convert"
 * runs the same migration as the menu item plus the comments rewire,
 * then disappears. Dismissals are remembered per note so we don't
 * pester users mid-flow.
 *
 * Renders nothing when:
 *   - the doc hasn't synced yet (`count === -1`)
 *   - the note is already pure-Excalidraw (`count === 0`)
 *   - the user has dismissed the banner for this note
 */
export function CanvasMigrationBanner({ noteId, doc }: CanvasMigrationBannerProps) {
  const blocksCount = useBlocksCount(doc);
  // Phase-3 step-1: rotated key so dismissals from the soft-banner era
  // don't suppress the new "blocks are read-only" copy.
  const storageKey = `notai:canvas-migration-readonly-dismissed:${noteId}`;
  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) === '1';
  });
  const [busy, setBusy] = React.useState(false);

  if (dismissed || blocksCount <= 0) return null;

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, '1');
    }
  };

  const convert = async () => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const result = migrateBlocksToExcalidraw(doc);
      if (result.count === 0) {
        toast.success('No text blocks to migrate.');
        dismiss();
        return;
      }
      toast.success(`Migrated ${result.count} block${result.count === 1 ? '' : 's'} to canvas.`);
      if (Object.keys(result.blockToElement).length > 0) {
        try {
          const { updated } = await rewireCommentsAfterMigration({
            noteId,
            mapping: result.blockToElement,
          });
          if (updated > 0) {
            toast.success(`Re-anchored ${updated} comment${updated === 1 ? '' : 's'}.`);
          }
        } catch (err) {
          toast.error(`Comment re-anchor failed: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      toast.error(`Migration failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-2 flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
      role="status"
      data-focus-hide
    >
      <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">These text blocks are read-only.</p>
        <p className="text-muted-foreground text-xs">
          The canvas is now the only place you can edit. Convert to keep editing — rich formatting
          collapses to plain text and your work moves onto the canvas.
        </p>
      </div>
      <button
        type="button"
        onClick={convert}
        disabled={busy}
        className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60"
      >
        {busy ? 'Converting…' : 'Convert to keep editing'}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

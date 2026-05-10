'use client';

import * as React from 'react';
import { Repeat, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import { getRecurringRollText } from '@/server/actions/recurrence';

interface Props {
  noteId: string;
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}

/**
 * "3 recurring tasks ready to roll" banner. Mounted on every note;
 * silently no-ops if there's nothing to roll. Dismissals are
 * per-note + per-day so the banner reappears tomorrow if the user
 * checks off another recurring task.
 */
export function RecurringRollBanner({ noteId, canvasRef }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const storageKey = `notai:recur-roll:${noteId}:${today}`;

  const [text, setText] = React.useState('');
  const [count, setCount] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey)) {
      setDismissed(true);
      return;
    }
    let cancelled = false;
    void getRecurringRollText(noteId)
      .then((res) => {
        if (cancelled) return;
        setText(res.text);
        setCount(res.count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [noteId, storageKey]);

  if (dismissed || count === 0 || !text) return null;

  const dismiss = () => {
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const insert = () => {
    const handle = canvasRef.current;
    const api = handle?.getExcalidrawApi?.();
    if (!api) {
      toast.error('Canvas not ready yet — try again in a moment.');
      return;
    }
    const id = appendTextToScene(api, text, { focus: true });
    if (!id) {
      toast.error("Couldn't roll — please try again.");
      return;
    }
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
    toast.success(`Rolled ${count} recurring task${count === 1 ? '' : 's'}`);
  };

  return (
    <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
      <Repeat className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <div className="text-foreground font-medium">
          {count} recurring task{count === 1 ? '' : 's'} ready to roll
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          New open instances with the next due date.
        </div>
      </div>
      <button
        type="button"
        className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium"
        onClick={insert}
      >
        Roll forward
        <ArrowRight className="size-3" />
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

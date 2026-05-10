'use client';
import * as React from 'react';
import { CalendarDays, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import { getYesterdayOpenTodos } from '@/server/actions/daily';

interface RolloverBannerProps {
  noteId: string;
  noteTitle: string;
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}

const DAILY_TITLE_RE = /^Daily — \d{4}-\d{2}-\d{2}$/;

/**
 * Shown only inside daily notes ("Daily — YYYY-MM-DD"). On mount, asks
 * the server for unchecked taskItems from yesterday's daily note and
 * offers a one-click roll-forward. Dismissals (and successful inserts)
 * are remembered per-note so the banner doesn't reappear after the user
 * has dealt with it.
 */
export function RolloverBanner({ noteId, noteTitle, canvasRef }: RolloverBannerProps) {
  const isDaily = DAILY_TITLE_RE.test(noteTitle);
  const storageKey = `notai:rollover:${noteId}`;

  const [items, setItems] = React.useState<string[]>([]);
  const [date, setDate] = React.useState('');
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!isDaily) return;
    if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey)) {
      setDismissed(true);
      return;
    }
    let cancelled = false;
    getYesterdayOpenTodos()
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setDate(res.date);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isDaily, storageKey]);

  if (!isDaily || dismissed || items.length === 0) return null;

  const dismiss = () => {
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const insert = () => {
    const handle = canvasRef.current;
    if (!handle) return;
    const api = handle.getExcalidrawApi?.();
    if (!api) {
      toast.error('Canvas not ready yet — try again in a moment.');
      return;
    }
    // Phase-3 era rollover: write directly onto the Excalidraw scene as a
    // single text element. Heading line is sentence-case; each task gets
    // a `[ ]` prefix so the existing ChecklistOverlay can toggle them.
    const body = `## Carried over from ${date}\n\n` + items.map((t) => `[ ] ${t}`).join('\n');
    const id = appendTextToScene(api, body, { focus: true });
    if (!id) {
      toast.error("Couldn't roll forward — please try again.");
      return;
    }
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
    toast.success(`Rolled forward ${items.length} task${items.length === 1 ? '' : 's'}`);
  };

  return (
    <div className="border-primary/30 bg-primary/5 mt-3 flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm">
      <CalendarDays className="text-primary mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-foreground font-medium">
          {items.length} open task{items.length === 1 ? '' : 's'} from {date}
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-xs">
          {items.slice(0, 3).join(' · ')}
          {items.length > 3 ? ` · +${items.length - 3} more` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={insert}
        className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-90"
      >
        Roll forward <ArrowRight className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground rounded-md p-1"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

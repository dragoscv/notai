'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Loader2 } from 'lucide-react';
import { showAiActionError } from '@/lib/ai-error-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@notai/ui/components/dialog';
import { Button } from '@notai/ui/components/button';
import { dailyReview } from '@/server/actions/daily-review';

interface ReviewState {
  summary: string;
  notes: Array<{ id: string; title: string; icon: string | null }>;
}

/**
 * End-of-day review card. Triggered from the header (or any caller
 * that flips `open`). Calls the AI review action lazily on first
 * open and caches the result for the lifetime of the dialog.
 */
export function DailyReviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [state, setState] = React.useState<ReviewState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const triedRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      triedRef.current = false;
      setState(null);
      return;
    }
    if (triedRef.current) return;
    triedRef.current = true;
    setLoading(true);
    dailyReview()
      .then(setState)
      .catch((err: unknown) => {
        showAiActionError(err, 'Could not build a review.');
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> End of day
          </DialogTitle>
          <DialogDescription>A short, calm wrap-up of what you wrote today.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" /> Composing your review\u2026
          </div>
        ) : state ? (
          <>
            <p className="font-serif text-base leading-relaxed">{state.summary}</p>
            {state.notes.length > 0 && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-[10px] uppercase tracking-widest">
                  Notes touched today
                </div>
                <ul className="space-y-1">
                  {state.notes.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/app/n/${n.id}`}
                        className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                        onClick={() => onOpenChange(false)}
                      >
                        <span>{n.icon ?? '\u{1F4DD}'}</span>
                        <span className="truncate">{n.title || 'Untitled'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

'use client';
import * as React from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { getThrowbackNote, type ThrowbackNote } from '@/server/actions/throwback';

/**
 * "Throwback" card. Shows a single random note the user hasn't touched
 * in 30+ days. One click jumps to the note; the refresh icon picks a
 * different one without reloading the page. Renders nothing if the
 * user has no archive yet (silent for first-week users).
 */
export function ThrowbackCard() {
  const [note, setNote] = React.useState<ThrowbackNote | null | undefined>(undefined);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const n = await getThrowbackNote();
      setNote(n);
    } catch {
      setNote(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // First-load placeholder & empty-state both render nothing — this is
  // a delightful nudge, not an essential surface, and a noisy "loading…"
  // skeleton would defeat the point.
  if (note === undefined || note === null) return null;

  return (
    <div className="bg-card relative overflow-hidden rounded-2xl border p-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <Clock className="size-3.5" />
        <span>Throwback &middot; {formatDaysAgo(note.daysAgo)}</span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          aria-label="Show a different throwback"
          title="Show a different one"
          className="hover:bg-muted ml-auto rounded p-1 disabled:opacity-50"
        >
          <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
        </button>
      </div>
      <Link
        href={`/app/n/${note.id}`}
        className="hover:bg-muted/40 -m-1 block rounded-xl p-1 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">{note.icon ?? '\uD83D\uDCDD'}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{note.title}</h3>
            {note.snippet && (
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
                {note.snippet}
              </p>
            )}
          </div>
          <ArrowRight className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
        </div>
      </Link>
    </div>
  );
}

function formatDaysAgo(days: number): string {
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  const rem = Math.round((days - years * 365) / 30);
  if (rem === 0) return years === 1 ? 'a year ago' : `${years} years ago`;
  return `${years}y ${rem}mo ago`;
}

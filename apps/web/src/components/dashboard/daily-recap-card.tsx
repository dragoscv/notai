'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Pen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getDailyRecap, saveRecapAsNote, type DailyRecap } from '@/server/actions/daily-recap';

const CACHE_KEY = 'notai:daily-recap';
const PENDING_APPEND_KEY = 'notai:pending-append';

/**
 * End-of-day card that summarises what the user wrote today. Quietly
 * disappears when the day's word count is too low — we don't want a
 * "you wrote nothing" guilt-trip on a slow day.
 */
export function DailyRecapCard() {
  const router = useRouter();
  const [data, setData] = React.useState<DailyRecap | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (forceRefresh = false) => {
    if (typeof window === 'undefined') return;
    if (!forceRefresh) {
      try {
        const cached = window.localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as DailyRecap;
          const today = new Date().toISOString().slice(0, 10);
          if (parsed.date === today) {
            setData(parsed);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    try {
      const fresh = await getDailyRecap();
      setData(fresh);
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      } catch {
        /* ignore */
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const saveAsNote = React.useCallback(async () => {
    if (!data?.summary) return;
    try {
      const { id } = await saveRecapAsNote({ date: data.date, summary: data.summary });
      // Hand the body to the editor via the established pending-append channel.
      try {
        window.localStorage.setItem(
          PENDING_APPEND_KEY,
          JSON.stringify({ noteId: id, text: data.summary }),
        );
      } catch {
        /* ignore */
      }
      router.push(`/app/n/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [data, router]);

  // Hide on no-write days so the dashboard doesn't shame anyone.
  if (!data || data.noteCount === 0 || data.wordCount < 30) return null;

  return (
    <div className="rounded-2xl border bg-emerald-500/5 p-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <CalendarCheck className="size-3.5" />
        <span>Today&apos;s recap</span>
        <span className="text-muted-foreground/70 ml-auto">
          {data.noteCount} note{data.noteCount === 1 ? '' : 's'} \u00b7{' '}
          {data.wordCount.toLocaleString()} words
        </span>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="hover:bg-muted ml-2 rounded p-1 disabled:opacity-50"
          title="Regenerate recap"
          aria-label="Refresh recap"
        >
          <RefreshCw className={loading ? 'size-3 animate-spin' : 'size-3'} />
        </button>
      </div>
      {data.summary ? (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{data.summary}</pre>
      ) : (
        <p className="text-muted-foreground text-sm">
          Connect an AI provider in Settings to get an end-of-day summary.
        </p>
      )}
      {data.summary && (
        <div className="mt-3">
          <button
            type="button"
            onClick={saveAsNote}
            className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90"
          >
            <Pen className="size-3.5" />
            Save as note
          </button>
        </div>
      )}
    </div>
  );
}

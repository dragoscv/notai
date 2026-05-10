'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  CalendarPlus,
  MessageCircle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  generateMorningBrief,
  askMorningBriefFollowup,
  type MorningBriefResult,
  type MorningBriefSource,
} from '@/server/actions/morning-brief';
import { getOrCreateDailyNote } from '@/server/actions/daily';

const STORAGE_PREFIX = 'notai:morning-brief:';

interface CachedBrief {
  markdown: string;
  generatedAt: string;
  date: string;
  sources: MorningBriefSource[];
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Calm, ADHD-friendly morning brief on the home dashboard. Auto-loads
 * once per local day, caches in localStorage, and exposes:
 *  - Refresh   → regenerate + reburn cache
 *  - Save to today → append the brief to today's daily note (uses the
 *                    same `notai:pending-append` handoff as Quick Capture).
 *  - Source chips that link straight to the contributing notes.
 */
export function MorningBriefCard() {
  const router = useRouter();
  const [brief, setBrief] = React.useState<CachedBrief | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [savingToToday, setSavingToToday] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [followupOpen, setFollowupOpen] = React.useState(false);
  const [followupQuestion, setFollowupQuestion] = React.useState('');
  const [followupAnswer, setFollowupAnswer] = React.useState<string | null>(null);
  const [followupBusy, setFollowupBusy] = React.useState(false);

  const storageKey = STORAGE_PREFIX + todayKey();
  const collapseKey = `${storageKey}:collapsed`;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result: MorningBriefResult = await generateMorningBrief();
      const cached: CachedBrief = {
        markdown: result.markdown,
        generatedAt: result.generatedAt,
        date: todayKey(),
        sources: result.sources,
      };
      setBrief(cached);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(cached));
      } catch {
        /* quota / privacy mode */
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedBrief;
        if (parsed.date === todayKey()) {
          setBrief({ ...parsed, sources: parsed.sources ?? [] });
          setCollapsed(window.localStorage.getItem(collapseKey) === '1');
          return;
        }
      }
      void load();
    } catch {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(collapseKey, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const saveToToday = React.useCallback(async () => {
    if (!brief || savingToToday) return;
    setSavingToToday(true);
    try {
      const note = await getOrCreateDailyNote();
      const header = `## Morning brief — ${formatDate(brief.generatedAt)}`;
      const body = `${header}\n\n${brief.markdown.trim()}`;
      window.localStorage.setItem(
        'notai:pending-append',
        JSON.stringify({ noteId: note.id, text: body, ts: Date.now() }),
      );
      router.push(`/app/n/${note.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSavingToToday(false);
    }
  }, [brief, savingToToday, router]);

  const askFollowup = React.useCallback(async () => {
    if (!brief || followupBusy) return;
    const q = followupQuestion.trim();
    if (q.length < 2) return;
    setFollowupBusy(true);
    setFollowupAnswer(null);
    try {
      const res = await askMorningBriefFollowup({
        question: q,
        briefMarkdown: brief.markdown,
        sources: brief.sources,
      });
      setFollowupAnswer(res.answer);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFollowupBusy(false);
    }
  }, [brief, followupBusy, followupQuestion]);

  const sources = brief?.sources ?? [];

  return (
    <section
      aria-label="Morning brief"
      className="bg-card/60 mb-4 overflow-hidden rounded-xl border shadow-sm"
    >
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <span
          aria-hidden
          className="from-primary to-primary/70 text-primary-foreground grid size-7 place-items-center rounded-md bg-gradient-to-br"
        >
          <Sparkles className="size-3.5" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight">Morning brief</h2>
        <span className="text-muted-foreground ml-1 text-[11px]">
          {brief ? `Updated ${formatTime(brief.generatedAt)}` : 'Personal & private'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {brief && (
            <button
              type="button"
              onClick={() => void saveToToday()}
              disabled={savingToToday}
              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] disabled:opacity-50"
              title="Save into today's daily note"
            >
              {savingToToday ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CalendarPlus className="size-3" />
              )}
              Save to today
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] disabled:opacity-50"
            title="Regenerate"
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Refresh
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1"
          >
            {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
        </div>
      </header>
      {!collapsed && (
        <div className="px-4 py-3 text-sm leading-relaxed">
          {loading && !brief && (
            <span className="text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Reading your recent notes…
            </span>
          )}
          {brief && (
            <>
              <div className="text-foreground/90 whitespace-pre-wrap">{brief.markdown}</div>
              {sources.length > 0 && (
                <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[11px]">
                  <span className="opacity-70">Drawn from</span>
                  {sources.map((s) => (
                    <Link
                      key={s.id}
                      href={`/app/n/${s.id}`}
                      className="bg-card hover:border-primary hover:text-foreground inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full border px-2 py-0.5"
                    >
                      <FileText className="size-3" />
                      <span className="truncate">{s.title}</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 border-t pt-2">
                {!followupOpen ? (
                  <button
                    type="button"
                    onClick={() => setFollowupOpen(true)}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px]"
                  >
                    <MessageCircle className="size-3" />
                    Ask about this
                  </button>
                ) : (
                  <div className="space-y-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void askFollowup();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        value={followupQuestion}
                        onChange={(e) => setFollowupQuestion(e.target.value)}
                        placeholder="What's most urgent today?"
                        disabled={followupBusy}
                        className="border-input bg-background flex-1 rounded-md border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                      <button
                        type="submit"
                        disabled={followupBusy || followupQuestion.trim().length < 2}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50"
                      >
                        {followupBusy ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Send className="size-3" />
                        )}
                        Ask
                      </button>
                    </form>
                    {followupAnswer && (
                      <div className="bg-muted/40 text-foreground/90 whitespace-pre-wrap rounded-md p-2 text-xs leading-relaxed">
                        {followupAnswer}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

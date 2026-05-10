'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Send, Loader2, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import { createNote } from '@/server/actions/notes';

interface Hit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  score: number;
}

/**
 * "Ask my notes" RAG dialog. Streams an NDJSON response from /api/ask and
 * renders the answer + cited sources. Designed to feel like a focused
 * conversation, not a search box.
 */
export function AskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const [question, setQuestion] = React.useState('');
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [answer, setAnswer] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savingNote, setSavingNote] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setQuestion('');
      setHits([]);
      setAnswer('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const ask = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setHits([]);
    setAnswer('');
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as
              | { type: 'hits'; hits: Hit[] }
              | { type: 'delta'; text: string }
              | { type: 'error'; message: string };
            if (ev.type === 'hits') setHits(ev.hits);
            else if (ev.type === 'delta') setAnswer((prev) => prev + ev.text);
            else if (ev.type === 'error') setError(ev.message);
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAnswerAsNote = React.useCallback(async () => {
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a || savingNote) return;
    setSavingNote(true);
    const t = toast.loading('Saving answer…');
    try {
      const note = await createNote({
        title: q.slice(0, 80),
        icon: '✨',
      });
      if (!note) throw new Error('Failed to create note');
      const sourcesBlock =
        hits.length === 0
          ? ''
          : '\n\n## Sources\n\n' +
            hits
              .map((h, i) => `[#${i + 1}] ${h.icon ?? '\uD83D\uDCDD'} ${h.title || 'Untitled'}`)
              .join('\n');
      const body = `# ${q}\n\n${a}${sourcesBlock}`;
      try {
        window.localStorage.setItem(
          'notai:pending-append',
          JSON.stringify({ noteId: note.id, text: body, ts: Date.now() }),
        );
      } catch {
        /* localStorage off — the note still opens */
      }
      toast.success('Answer saved', { id: t });
      onOpenChange(false);
      router.push(`/app/n/${note.id}`);
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    } finally {
      setSavingNote(false);
    }
  }, [question, answer, hits, savingNote, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            Ask my notes
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="What does Future Me need to remember?"
            className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            type="button"
            onClick={ask}
            disabled={loading}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>

        {error && (
          <div className="text-destructive flex items-center gap-1 text-sm">
            <X className="size-3.5" /> {error}
          </div>
        )}

        {answer && (
          <div className="bg-card whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed">
            <AnswerWithCitations text={answer} hits={hits} onNavigate={() => onOpenChange(false)} />
          </div>
        )}

        {answer && !loading && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveAnswerAsNote()}
              disabled={savingNote}
              className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {savingNote ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )}
              Save answer to a new note
            </button>
          </div>
        )}

        {hits.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Sources</p>
            <ul className="space-y-1">
              {hits.map((h, i) => (
                <li key={h.id}>
                  <Link
                    href={`/app/n/${h.id}`}
                    className="hover:bg-muted flex items-start gap-2 rounded-md p-2 text-sm"
                    onClick={() => onOpenChange(false)}
                  >
                    <span className="text-muted-foreground w-6 shrink-0 text-right text-xs">
                      [#{i + 1}]
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">
                        {h.icon ?? '📝'} {h.title}
                      </span>
                      <span className="text-muted-foreground line-clamp-1 text-xs">
                        {h.snippet}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline-citation renderer: turns `[#n]` markers in the streamed answer
 * into clickable chips that navigate to the matching note. Mirrors
 * `AnswerWithCitations` in `apps/web/src/components/ask/ask-client.tsx`
 * so the dialog and the full Ask page render citations identically.
 */
function AnswerWithCitations({
  text,
  hits,
  onNavigate,
}: {
  text: string;
  hits: Hit[];
  onNavigate?: () => void;
}) {
  const paragraphs = text.split(/\n\s*\n+/);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, pi) => {
        const cited = uniqueCitedHits(para, hits);
        const parts = para.split(/(\[#\d+\])/g);
        return (
          <div key={pi}>
            {cited.length > 0 && (
              <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-1 text-[11px]">
                <span>Sources:</span>
                {cited.map((c) => (
                  <Link
                    key={c.n}
                    href={`/app/n/${c.hit.id}`}
                    title={c.hit.snippet}
                    onClick={onNavigate}
                    className="bg-muted inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-400"
                  >
                    <span className="font-mono">#{c.n}</span>
                    <span className="max-w-[14ch] truncate">{c.hit.title || 'Untitled'}</span>
                  </Link>
                ))}
              </div>
            )}
            <span className="block whitespace-pre-wrap">
              {parts.map((p, i) => {
                const m = /^\[#(\d+)\]$/.exec(p);
                if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
                const n = Number(m[1]);
                const hit = hits[n - 1];
                if (!hit) return <React.Fragment key={i}>{p}</React.Fragment>;
                return (
                  <Link
                    key={i}
                    href={`/app/n/${hit.id}`}
                    title={hit.title}
                    onClick={onNavigate}
                    className="mx-0.5 inline-flex items-center rounded bg-amber-500/15 px-1 py-0 align-baseline text-[11px] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                  >
                    #{n}
                  </Link>
                );
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function uniqueCitedHits(paragraph: string, hits: Hit[]): Array<{ n: number; hit: Hit }> {
  const seen = new Set<number>();
  const out: Array<{ n: number; hit: Hit }> = [];
  const re = /\[#(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph)) != null) {
    const n = Number(m[1]);
    if (seen.has(n)) continue;
    const hit = hits[n - 1];
    if (!hit) continue;
    seen.add(n);
    out.push({ n, hit });
  }
  return out;
}

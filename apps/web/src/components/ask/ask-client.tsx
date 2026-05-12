'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, Loader2, FileText, Square, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Textarea } from '@notai/ui/components/textarea';
import { cn } from '@notai/lib/utils';
import { createNote } from '@/server/actions/notes';

interface Hit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  score: number;
}

interface AskTurn {
  id: string;
  question: string;
  hits: Hit[];
  answer: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

const SUGGESTION_KEYS = ['suggestion1', 'suggestion2', 'suggestion3', 'suggestion4'] as const;

/**
 * Conversational "ask my notes" surface backed by `/api/ask` (NDJSON
 * stream of `hits` then `delta` chunks). We keep history in memory so
 * the user can scroll back through a session, but it resets on reload —
 * the value is in the citations, not the chat log.
 */
export function AskClient() {
  const t = useTranslations('appFeatures.ask');
  const [question, setQuestion] = React.useState('');
  const [turns, setTurns] = React.useState<AskTurn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const ask = React.useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      // Persist to a small ring buffer of recent questions so the
      // EmptyState can offer them again next session. Capped at 10.
      try {
        const HISTORY_KEY = 'notai:ask:history';
        const raw = window.localStorage.getItem(HISTORY_KEY);
        const prior = raw ? (JSON.parse(raw) as string[]) : [];
        const next = [q, ...prior.filter((x) => x !== q)].slice(0, 10);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setBusy(true);
      setQuestion('');
      const turnId = crypto.randomUUID();
      setTurns((t) => [
        ...t,
        { id: turnId, question: q, hits: [], answer: '', status: 'streaming' },
      ]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const msg = (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`;
          setTurns((t) =>
            t.map((tt) => (tt.id === turnId ? { ...tt, status: 'error', error: String(msg) } : tt)),
          );
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line) continue;
            try {
              const evt = JSON.parse(line) as
                | { type: 'hits'; hits: Hit[] }
                | { type: 'delta'; text: string }
                | { type: 'error'; message: string };
              if (evt.type === 'hits') {
                setTurns((t) => t.map((tt) => (tt.id === turnId ? { ...tt, hits: evt.hits } : tt)));
              } else if (evt.type === 'delta') {
                setTurns((t) =>
                  t.map((tt) => (tt.id === turnId ? { ...tt, answer: tt.answer + evt.text } : tt)),
                );
              } else if (evt.type === 'error') {
                setTurns((t) =>
                  t.map((tt) =>
                    tt.id === turnId ? { ...tt, status: 'error', error: evt.message } : tt,
                  ),
                );
              }
            } catch {
              /* ignore malformed line */
            }
          }
        }
        setTurns((t) =>
          t.map((tt) =>
            tt.id === turnId && tt.status === 'streaming' ? { ...tt, status: 'done' } : tt,
          ),
        );
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') {
          setTurns((prev) =>
            prev.map((tt) =>
              tt.id === turnId
                ? {
                    ...tt,
                    status: tt.answer ? 'done' : 'error',
                    error: tt.answer ? undefined : t('stopped'),
                  }
                : tt,
            ),
          );
        } else {
          setTurns((t) =>
            t.map((tt) => (tt.id === turnId ? { ...tt, status: 'error', error: String(err) } : tt)),
          );
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        taRef.current?.focus();
      }
    },
    [busy],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(question);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask(question);
    }
  };
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4">
      <div ref={scrollerRef} className="flex-1 space-y-8 py-8">
        {turns.length === 0 ? (
          <EmptyState onPick={(s) => void ask(s)} />
        ) : (
          turns.map((tt) => <Turn key={tt.id} turn={tt} />)
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-background/80 sticky bottom-0 -mx-4 border-t px-4 py-3 backdrop-blur"
      >
        <div className="bg-card focus-within:border-primary/50 flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-colors">
          <Textarea
            ref={taRef}
            value={question}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            rows={1}
            className="min-h-[2.25rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stop}
              aria-label={t('stop')}
            >
              <Square className="size-4" fill="currentColor" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={question.trim().length < 2}
              aria-label={t('ask')}
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[11px]">{t('footnote')}</p>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const t = useTranslations('appFeatures.ask');
  const [history, setHistory] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('notai:ask:history');
      if (raw) setHistory(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <div className="flex flex-col items-center justify-center pt-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 grid size-12 place-items-center rounded-2xl">
        <Sparkles className="size-6" />
      </div>
      <h2 className="text-xl font-semibold">{t('emptyTitle')}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">{t('emptyBody')}</p>
      <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTION_KEYS.map((key) => {
          const s = t(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(s)}
              className="bg-card hover:border-primary/40 hover:bg-primary/5 rounded-xl border p-3 text-left text-sm transition-colors"
            >
              {s}
            </button>
          );
        })}
      </div>
      {history.length > 0 && (
        <div className="mt-8 w-full max-w-lg text-left">
          <div className="text-muted-foreground mb-2 text-[11px] uppercase tracking-wide">
            {t('recentQuestions')}
          </div>
          <ul className="space-y-1">
            {history.map((q, i) => (
              <li key={`${i}-${q}`}>
                <button
                  type="button"
                  onClick={() => onPick(q)}
                  className="hover:bg-muted w-full truncate rounded-lg px-2 py-1.5 text-left text-sm"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Turn({ turn }: { turn: AskTurn }) {
  const t = useTranslations('appFeatures.ask');
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2 text-sm">
          {turn.question}
        </div>
      </div>

      <div className="space-y-3">
        {turn.hits.length > 0 && <Citations hits={turn.hits} />}
        <div
          className={cn(
            'bg-card rounded-2xl rounded-bl-md border p-4 text-sm leading-relaxed',
            turn.status === 'error' && 'border-destructive/40 bg-destructive/5',
          )}
        >
          {turn.status === 'streaming' && turn.answer.length === 0 && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="size-3.5 animate-spin" /> {t('searching')}
            </p>
          )}
          {turn.answer && <AnswerWithCitations text={turn.answer} hits={turn.hits} />}
          {turn.status === 'error' && (
            <p className="text-destructive text-xs">
              {t('errorPrefix', { error: turn.error ?? t('unknownError') })}
            </p>
          )}
          {turn.status === 'done' && turn.answer && (
            <div className="mt-3 flex justify-end gap-2">
              <SaveAnswerButton question={turn.question} answer={turn.answer} hits={turn.hits} />
              <CopyButton text={stripCitations(turn.answer)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function stripCitations(text: string): string {
  return text.replace(/\s*\[#\d+\]/g, '').trim();
}

function SaveAnswerButton({
  question,
  answer,
  hits,
}: {
  question: string;
  answer: string;
  hits: Hit[];
}) {
  const t = useTranslations('appFeatures.ask');
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    const tid = toast.loading(t('savingAnswer'));
    try {
      const note = await createNote({
        title: question.trim().slice(0, 80) || t('saveAnswerTitle'),
        icon: '\u2728',
      });
      if (!note) throw new Error(t('failedCreateNote'));
      const sourcesBlock =
        hits.length === 0
          ? ''
          : `\n\n## ${t('saveSourcesHeader')}\n\n` +
            hits
              .map((h, i) => `[#${i + 1}] ${h.icon ?? '\uD83D\uDCDD'} ${h.title || t('untitled')}`)
              .join('\n');
      const body = `# ${question.trim()}\n\n${answer.trim()}${sourcesBlock}`;
      try {
        window.localStorage.setItem(
          'notai:pending-append',
          JSON.stringify({ noteId: note.id, text: body, ts: Date.now() }),
        );
      } catch {
        /* localStorage off */
      }
      toast.success(t('answerSaved'), { id: tid });
      router.push(`/app/n/${note.id}`);
    } catch (err) {
      toast.error((err as Error).message, { id: tid });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void onSave()}
      disabled={busy}
      className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
      {t('saveToNote')}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations('appFeatures.ask');
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? t('copied') : t('copy')}
    </button>
  );
}

function Citations({ hits }: { hits: Hit[] }) {
  const t = useTranslations('appFeatures.ask');
  return (
    <div className="flex flex-wrap gap-1.5">
      {hits.map((h, i) => (
        <Link
          key={h.id}
          href={`/app/n/${h.id}`}
          title={h.snippet}
          className="bg-muted hover:bg-primary/15 hover:text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors"
        >
          <span className="text-muted-foreground font-mono">#{i + 1}</span>
          {h.icon ? (
            <span aria-hidden>{h.icon}</span>
          ) : (
            <FileText className="text-muted-foreground size-3" />
          )}
          <span className="max-w-[16ch] truncate">{h.title || t('untitled')}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Render the assistant text paragraph-by-paragraph. Each paragraph
 * gets a small chip-row above it listing the unique sources cited
 * inside it (deduped, in citation order); inside the paragraph the
 * inline `[#n]` chips remain. Source attribution is per-paragraph so
 * the reader can scan which note backs each claim without leaving the
 * answer.
 */
function AnswerWithCitations({ text, hits }: { text: string; hits: Hit[] }) {
  const t = useTranslations('appFeatures.ask');
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
                <span>{t('sources')}</span>
                {cited.map((c) => (
                  <Link
                    key={c.n}
                    href={`/app/n/${c.hit.id}`}
                    title={c.hit.snippet}
                    className="bg-muted hover:bg-primary/15 hover:text-primary inline-flex items-center gap-1 rounded-full px-1.5 py-0.5"
                  >
                    <span className="font-mono">#{c.n}</span>
                    <span className="max-w-[14ch] truncate">{c.hit.title || t('untitled')}</span>
                  </Link>
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">
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
                    className="bg-primary/15 text-primary hover:bg-primary/25 mx-0.5 inline-flex items-center rounded px-1 py-0 align-baseline text-[11px] font-medium"
                  >
                    #{n}
                  </Link>
                );
              })}
            </p>
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

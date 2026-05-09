'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Send, Loader2, FileText } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Textarea } from '@notai/ui/components/textarea';
import { cn } from '@notai/lib/utils';

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

const SUGGESTIONS = [
  'What did I learn this week?',
  'Summarise my recent meeting notes',
  'List every TODO scattered across my notes',
  'What are my open questions about the project?',
];

/**
 * Conversational "ask my notes" surface backed by `/api/ask` (NDJSON
 * stream of `hits` then `delta` chunks). We keep history in memory so
 * the user can scroll back through a session, but it resets on reload —
 * the value is in the citations, not the chat log.
 */
export function AskClient() {
  const [question, setQuestion] = React.useState('');
  const [turns, setTurns] = React.useState<AskTurn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const ask = React.useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setBusy(true);
      setQuestion('');
      const turnId = crypto.randomUUID();
      setTurns((t) => [
        ...t,
        { id: turnId, question: q, hits: [], answer: '', status: 'streaming' },
      ]);

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
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
        setTurns((t) =>
          t.map((tt) => (tt.id === turnId ? { ...tt, status: 'error', error: String(err) } : tt)),
        );
      } finally {
        setBusy(false);
        taRef.current?.focus();
      }
    },
    [busy],
  );

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
          turns.map((t) => <Turn key={t.id} turn={t} />)
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
            placeholder="Ask anything about your notes…"
            rows={1}
            className="min-h-[2.25rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || question.trim().length < 2}
            aria-label="Ask"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          Notai cites your notes by number. Click any citation to open the source.
        </p>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center pt-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 grid size-12 place-items-center rounded-2xl">
        <Sparkles className="size-6" />
      </div>
      <h2 className="text-xl font-semibold">Ask your second brain</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Notai searches your notes with semantic similarity, then writes a grounded answer with
        citations to the source notes.
      </p>
      <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="bg-card hover:border-primary/40 hover:bg-primary/5 rounded-xl border p-3 text-left text-sm transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Turn({ turn }: { turn: AskTurn }) {
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
              <Loader2 className="size-3.5 animate-spin" /> Searching your notes…
            </p>
          )}
          {turn.answer && <AnswerWithCitations text={turn.answer} hits={turn.hits} />}
          {turn.status === 'error' && (
            <p className="text-destructive text-xs">
              Something went wrong: {turn.error ?? 'unknown error'}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Citations({ hits }: { hits: Hit[] }) {
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
          <span className="max-w-[16ch] truncate">{h.title || 'Untitled'}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Render the assistant text and turn `[#n]` markers into clickable links
 * to the matching note. Splits on the citation regex so we don't have to
 * pull in a markdown renderer for this one feature.
 */
function AnswerWithCitations({ text, hits }: { text: string; hits: Hit[] }) {
  const parts = text.split(/(\[#\d+\])/g);
  return (
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
  );
}

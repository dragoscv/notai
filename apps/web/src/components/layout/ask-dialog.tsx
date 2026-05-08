'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';

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
  const abortRef = React.useRef<AbortController | null>(null);

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
            {answer}
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

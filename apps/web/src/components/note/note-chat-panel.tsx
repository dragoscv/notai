'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  MessageSquare,
  Send,
  Square,
  Trash2,
  X,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Textarea } from '@notai/ui/components/textarea';
import { cn } from '@notai/lib/utils';
import { listChatMessages, clearChat, type ChatMessage } from '@/server/actions/chat-with-note';

interface Citation {
  label: string;
  noteId: string;
  title: string;
}

interface InFlightTurn {
  id: string;
  question: string;
  citations: Citation[];
  answer: string;
  status: 'streaming' | 'error';
  error?: string;
}

/**
 * Right-side per-note chat. Persists to `note_chat_messages` so the
 * conversation survives reloads. Streams via `/api/notes/chat`.
 */
export function NoteChatPanel({
  noteId,
  open,
  onOpenChange,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('editor.chat');
  const tToast = useTranslations('editor.chat.toast');
  const [history, setHistory] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [inFlight, setInFlight] = React.useState<InFlightTurn | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Load history when panel opens (lazy — saves a query when the panel
  // is closed, which is the default).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listChatMessages(noteId)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error(tToast('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, noteId]);

  // Auto-scroll to bottom when history or in-flight answer grows.
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, inFlight]);

  const ask = React.useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setBusy(true);
      setQuestion('');
      const turnId = crypto.randomUUID();
      setInFlight({ id: turnId, question: q, citations: [], answer: '', status: 'streaming' });

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch('/api/notes/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId, question: q }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const msg = (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`;
          setInFlight((cur) =>
            cur && cur.id === turnId ? { ...cur, status: 'error', error: String(msg) } : cur,
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
                | { type: 'citations'; items: Citation[] }
                | { type: 'delta'; text: string }
                | { type: 'message'; userId: string | null; assistantId: string | null }
                | { type: 'error'; message: string }
                | { type: 'done' };
              if (evt.type === 'citations') {
                setInFlight((cur) =>
                  cur && cur.id === turnId ? { ...cur, citations: evt.items } : cur,
                );
              } else if (evt.type === 'delta') {
                setInFlight((cur) =>
                  cur && cur.id === turnId ? { ...cur, answer: cur.answer + evt.text } : cur,
                );
              } else if (evt.type === 'error') {
                setInFlight((cur) =>
                  cur && cur.id === turnId ? { ...cur, status: 'error', error: evt.message } : cur,
                );
              } else if (evt.type === 'done') {
                // Server has persisted both rows — refetch history to get
                // canonical IDs/timestamps and clear the in-flight buffer.
                listChatMessages(noteId)
                  .then((rows) => {
                    setHistory(rows);
                    setInFlight(null);
                  })
                  .catch(() => setInFlight(null));
              }
            } catch {
              /* ignore malformed line */
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') {
          // Keep whatever was streamed so far so the user can read it.
          // Server already persisted the user message; assistant message
          // wasn't written because we cut it short — that's expected.
          setInFlight((cur) =>
            cur && cur.id === turnId
              ? { ...cur, status: 'error', error: cur.answer ? undefined : tToast('stopped') }
              : cur,
          );
        } else {
          setInFlight((cur) =>
            cur && cur.id === turnId ? { ...cur, status: 'error', error: String(err) } : cur,
          );
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        taRef.current?.focus();
      }
    },
    [busy, noteId],
  );

  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  const onClear = async () => {
    if (!confirm(t('confirmClear'))) return;
    try {
      await clearChat(noteId);
      setHistory([]);
      setInFlight(null);
      toast.success(tToast('cleared'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!open) return null;

  const isEmpty = !loading && history.length === 0 && !inFlight;

  return (
    <aside
      className="bg-card flex h-full w-[360px] shrink-0 flex-col border-l"
      data-focus-hide
      aria-label={t('aria.panel')}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <MessageSquare className="size-4 text-amber-500" />
        <span className="text-sm font-semibold">{t('title')}</span>
        <span className="text-muted-foreground ml-1 truncate text-xs">{t('subtitle')}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClear}
            aria-label={t('clear')}
            title={t('clearTitle')}
            disabled={loading || (history.length === 0 && !inFlight)}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            aria-label={t('close')}
            title={t('closeTitle')}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </header>

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            {t('loading')}
          </div>
        ) : isEmpty ? (
          <EmptyState onPick={(s) => void ask(s)} />
        ) : (
          <>
            {history.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} citations={m.citations} />
            ))}
            {inFlight && (
              <>
                <Bubble role="user" content={inFlight.question} citations={null} />
                {(inFlight.answer || inFlight.status === 'streaming') && (
                  <Bubble
                    role="assistant"
                    content={inFlight.answer || '…'}
                    citations={inFlight.citations}
                    streaming={inFlight.status === 'streaming'}
                  />
                )}
                {inFlight.status === 'error' && inFlight.error && (
                  <p className="text-destructive text-xs">{inFlight.error}</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="border-t p-2"
      >
        <div className="bg-background focus-within:border-primary/50 flex items-end gap-1 rounded-xl border p-1.5">
          <Textarea
            ref={taRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
            placeholder={t('placeholder')}
            rows={1}
            className="min-h-[2rem] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          {busy ? (
            <Button
              type="button"
              size="icon-sm"
              variant="destructive"
              onClick={stop}
              aria-label={t('stop')}
            >
              <Square className="size-3.5" fill="currentColor" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={question.trim().length < 1}
              aria-label={t('send')}
            >
              <Send className="size-3.5" />
            </Button>
          )}
        </div>
      </form>
    </aside>
  );
}

function Bubble({
  role,
  content,
  citations,
  streaming,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[] | null;
  streaming?: boolean;
}) {
  const t = useTranslations('editor.chat');
  const [copied, setCopied] = React.useState(false);
  const isUser = role === 'user';
  const onCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[92%] whitespace-pre-wrap rounded-lg border px-3 py-2 text-sm leading-relaxed',
          isUser ? 'bg-primary/10 border-primary/20' : 'bg-background',
        )}
      >
        {content}
        {streaming && (
          <span className="text-muted-foreground ml-1 inline-block animate-pulse">▍</span>
        )}
      </div>
      {!isUser && citations && citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {citations.map((c) => (
            <Link
              key={`${c.label}-${c.noteId}`}
              href={`/app/n/${c.noteId}`}
              className="text-muted-foreground hover:text-primary bg-background inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
              title={c.title}
            >
              <Sparkles className="size-2.5" />
              {c.label}
              <span className="max-w-[120px] truncate">{c.title}</span>
            </Link>
          ))}
        </div>
      )}
      {!isUser && !streaming && (
        <button
          type="button"
          onClick={onCopy}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[10px]"
          aria-label={t('copy')}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? t('copied') : t('copy')}
        </button>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const t = useTranslations('editor.chat.empty');
  const suggestions = [t('suggestion1'), t('suggestion2'), t('suggestion3'), t('suggestion4')];
  return (
    <div className="text-muted-foreground space-y-3 py-4 text-center text-xs">
      <Sparkles className="text-primary mx-auto size-5" />
      <p>{t('intro')}</p>
      <ul className="space-y-1.5 text-left">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="hover:bg-accent hover:text-foreground w-full rounded border px-2.5 py-1.5 text-left"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

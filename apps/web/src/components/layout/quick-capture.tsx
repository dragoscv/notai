'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X, ArrowRight, Save, Send, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@notai/ui/components/dialog';
import { Button } from '@notai/ui/components/button';
import { Textarea } from '@notai/ui/components/textarea';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { quickCapture } from '@/server/actions/quick-capture';
import { quickCaptureBatch } from '@/server/actions/quick-capture-batch';
import {
  suggestQuickCaptureDestination,
  type DestinationMatch,
} from '@/server/actions/suggest-destination';

const STORAGE_KEY = 'notai:quick-capture:draft';
const PENDING_APPEND_KEY = 'notai:pending-append';
const PENDING_APPENDS_KEY = 'notai:pending-appends';

/**
 * Split free-form quick-capture text into atomic thoughts. Two
 * paragraphs separated by a blank line is the strongest signal; if
 * the user uses single newlines we still split, then re-join short
 * fragments (under 12 chars) so half-typed lists like "milk\nbread\n"
 * become "milk bread" rather than three near-empty captures.
 */
function splitIntoThoughts(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const blockSplit = trimmed
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (blockSplit.length >= 2) return blockSplit;
  return trimmed
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Floating bottom-right bubble + ⌘. dialog overlay.
 *
 * Goal: capture a thought in under a second, no matter where the user is
 * in the app. Drafts persist to localStorage between sessions so a tab
 * crash never loses an in-progress capture. Two save modes:
 *   - "Save"          → creates the note and stays put (great for rapid-fire).
 *   - "Save & open"   → creates the note and navigates to it.
 */
export function QuickCapture() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'open' | 'append' | 'batch' | null>(null);
  const [matches, setMatches] = React.useState<DestinationMatch[]>([]);
  const [matchesPending, setMatchesPending] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Hydrate draft once on the first open.
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (!open || hydrated.current) return;
    hydrated.current = true;
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v) setText(v);
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    try {
      if (text) window.localStorage.setItem(STORAGE_KEY, text);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [text, open]);

  React.useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 30);
  }, [open]);

  useHotkey('mod+.', () => setOpen((v) => !v), { id: 'quick-capture' });

  // Listen for an external "open me" event so the mobile FAB (and any
  // future surface) can trigger Quick Capture without prop drilling.
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('notai:quick-capture-open', handler);
    return () => window.removeEventListener('notai:quick-capture-open', handler);
  }, []);

  // Debounced semantic suggestion: once the draft is substantive, ask
  // the server which existing notes look like a good home for it.
  React.useEffect(() => {
    if (!open) return;
    const trimmed = text.trim();
    if (trimmed.length < 40) {
      setMatches([]);
      setMatchesPending(false);
      return;
    }
    setMatchesPending(true);
    const handle = window.setTimeout(async () => {
      try {
        const found = await suggestQuickCaptureDestination({ text: trimmed, topK: 2 });
        setMatches(found);
      } catch {
        setMatches([]);
      } finally {
        setMatchesPending(false);
      }
    }, 700);
    return () => window.clearTimeout(handle);
  }, [text, open]);

  /**
   * "Append to <existing note>" flow. We don't mutate the note's Y.Doc
   * server-side (that would race the realtime provider). Instead we
   * stash the payload in localStorage and route to the note; the note
   * workspace picks it up on mount and appends client-side over the
   * live Y.Doc.
   */
  const appendToExisting = React.useCallback(
    (m: DestinationMatch) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy('append');
      try {
        window.localStorage.setItem(
          PENDING_APPEND_KEY,
          JSON.stringify({ noteId: m.id, text: trimmed, ts: Date.now() }),
        );
        window.localStorage.removeItem(STORAGE_KEY);
        setText('');
        setMatches([]);
        setOpen(false);
        router.push(`/app/n/${m.id}`);
      } catch (e) {
        toast.error((e as Error).message);
        setBusy(null);
      }
    },
    [text, busy, router],
  );

  const sendBatch = React.useCallback(async () => {
    const items = splitIntoThoughts(text);
    if (items.length < 2 || busy) return;
    setBusy('batch');
    const t = toast.loading(`Routing ${items.length} thoughts\u2026`);
    try {
      const res = await quickCaptureBatch({ items });
      // Stash the per-note appends so each note picks up its slice on
      // mount via the existing pending-append watcher in note-workspace.
      if (res.appends.length > 0) {
        try {
          const existingRaw = window.localStorage.getItem(PENDING_APPENDS_KEY);
          const existing = existingRaw ? (JSON.parse(existingRaw) as unknown[]) : [];
          const next = [
            ...(Array.isArray(existing) ? existing : []),
            ...res.appends.map((a) => ({
              noteId: a.noteId,
              text: a.text,
              ts: Date.now(),
            })),
          ];
          window.localStorage.setItem(PENDING_APPENDS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setText('');
      setMatches([]);

      const summaryParts: string[] = [];
      if (res.appends.length > 0) {
        summaryParts.push(
          `${res.appends.length} routed to existing note${res.appends.length > 1 ? 's' : ''}`,
        );
      }
      if (res.newNote) summaryParts.push(`${res.newNote.count} captured fresh`);
      toast.success('Batch sent', {
        id: t,
        description: summaryParts.join(' \u00b7 '),
      });

      // Navigate to the freshest destination: a new note if any,
      // otherwise the first append target.
      const target = res.newNote?.id ?? res.appends[0]?.noteId ?? null;
      setOpen(false);
      if (target) router.push(`/app/n/${target}`);
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    } finally {
      setBusy(null);
    }
  }, [text, busy, router]);

  const save = async (mode: 'save' | 'open') => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(mode);
    try {
      const note = await quickCapture({ text: body });
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setText('');
      if (mode === 'open') {
        setOpen(false);
        router.push(`/app/n/${note.id}`);
      } else {
        toast.success('Captured', { description: note.title });
        // Stay open for rapid-fire captures.
        setTimeout(() => taRef.current?.focus(), 30);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {/* Floating action bubble. Hidden in Tauri sticky windows. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick capture"
        title="Quick capture (⌘.)"
        data-focus-hide
        className="from-primary to-primary/80 text-primary-foreground hover:shadow-primary/40 fixed bottom-5 right-5 z-30 grid size-12 place-items-center rounded-full bg-gradient-to-br shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <Sparkles className="size-5" />
        <span className="sr-only">Quick capture</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-xl gap-3 p-0"
          onInteractOutside={(e) => {
            // If the user has unsaved text, treat as "minimize" — keep draft.
            if (text.trim().length > 0) e.preventDefault();
          }}
        >
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <Sparkles className="text-primary size-4" />
            <DialogTitle className="text-sm font-semibold">Quick capture</DialogTitle>
            <DialogDescription className="text-muted-foreground ml-1 text-[11px]">
              Drop a thought — title is the first line.
            </DialogDescription>
            <button
              type="button"
              className="hover:bg-accent ml-auto rounded p-1"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="px-4">
            <Textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save(e.shiftKey ? 'open' : 'save');
                }
              }}
              rows={6}
              placeholder="Capture a quick thought…"
              className="bg-card resize-none border text-sm leading-relaxed"
            />
          </div>
          {(matches.length > 0 || matchesPending) && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 px-4 pb-1 text-[11px]">
              <span className="opacity-70">
                {matchesPending ? 'Looking for related notes…' : 'Looks like:'}
              </span>
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!!busy}
                  onClick={() => appendToExisting(m)}
                  title={m.snippet}
                  className="bg-card hover:border-primary hover:text-foreground inline-flex max-w-[18rem] items-center gap-1 truncate rounded-full border px-2 py-0.5 disabled:opacity-50"
                >
                  <Send className="size-3" />
                  <span className="truncate">Append to {m.title || 'Untitled'}</span>
                </button>
              ))}
            </div>
          )}
          <div className="text-muted-foreground flex items-center justify-between gap-2 border-t px-4 py-2 text-[11px]">
            <span>
              <kbd className="bg-card mr-1 rounded border px-1 font-mono text-[10px]">⌘↵</kbd>
              save
              <kbd className="bg-card mx-1 rounded border px-1 font-mono text-[10px]">⇧⌘↵</kbd>
              save &amp; open
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={!!busy}>
                Cancel
              </Button>
              {splitIntoThoughts(text).length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void sendBatch()}
                  disabled={!!busy}
                  title="Split each line/paragraph and route to its best home"
                >
                  {busy === 'batch' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Layers className="size-3.5" />
                  )}
                  Send batch
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void save('save')}
                disabled={text.trim().length === 0 || !!busy}
              >
                {busy === 'save' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                onClick={() => void save('open')}
                disabled={text.trim().length === 0 || !!busy}
              >
                {busy === 'open' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
                Save &amp; open
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

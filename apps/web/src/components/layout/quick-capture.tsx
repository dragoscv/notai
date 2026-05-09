'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X, ArrowRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@notai/ui/components/dialog';
import { Button } from '@notai/ui/components/button';
import { Textarea } from '@notai/ui/components/textarea';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { quickCapture } from '@/server/actions/quick-capture';

const STORAGE_KEY = 'notai:quick-capture:draft';

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
  const [busy, setBusy] = React.useState<'save' | 'open' | null>(null);
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

  useHotkey('mod+.', () => setOpen((v) => !v));

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

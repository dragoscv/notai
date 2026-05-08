'use client';
import * as React from 'react';
import { Sparkles, Loader2, Copy, ListChecks, ScrollText, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import { summarizeNote, extractActionItems, rewriteForClarity } from '@/server/actions/ai-actions';

type Mode = 'summary' | 'actions' | 'rewrite';

const META: Record<Mode, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  summary: { label: 'Summary', Icon: ScrollText },
  actions: { label: 'Action items', Icon: ListChecks },
  rewrite: { label: 'Rewrite for clarity', Icon: Wand2 },
};

/**
 * Note-level AI actions. Renders a dropdown trigger and a result dialog.
 * Each mode hits a different server action; we display the response and
 * let the user copy or insert it into the note.
 */
export function NoteAiMenu({
  noteId,
  onInsert,
}: {
  noteId: string;
  onInsert?: (markdown: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>('summary');
  const [result, setResult] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const run = async (m: Mode) => {
    setMenuOpen(false);
    setMode(m);
    setOpen(true);
    setResult('');
    setLoading(true);
    try {
      const fn =
        m === 'summary' ? summarizeNote : m === 'actions' ? extractActionItems : rewriteForClarity;
      const out = await fn(noteId);
      setResult(out);
    } catch (err) {
      toast.error((err as Error).message);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const Icon = META[mode].Icon;
  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
        >
          <Sparkles className="size-3.5 text-amber-500" />
          AI
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10"
              aria-label="Close menu"
            />
            <ul className="bg-popover absolute right-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border text-sm shadow-md">
              {(Object.keys(META) as Mode[]).map((m) => {
                const I = META[m].Icon;
                return (
                  <li key={m}>
                    <button
                      type="button"
                      className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left"
                      onClick={() => run(m)}
                    >
                      <I className="size-4" /> {META[m].label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="size-4" /> {META[mode].label}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-card min-h-[140px] whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed">
            {loading ? (
              <span className="text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Thinking…
              </span>
            ) : (
              result || 'No output.'
            )}
          </div>
          {!loading && result && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  toast.success('Copied');
                }}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
              >
                <Copy className="size-3.5" /> Copy
              </button>
              {onInsert && (
                <button
                  type="button"
                  onClick={() => {
                    onInsert(result);
                    setOpen(false);
                    toast.success('Inserted');
                  }}
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white"
                >
                  Insert into note
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

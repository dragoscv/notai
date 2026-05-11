'use client';
import * as React from 'react';
import {
  Sparkles,
  Loader2,
  Copy,
  ListChecks,
  ScrollText,
  Wand2,
  Network,
  PenLine,
  ListTree,
  Heading1,
  SpellCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import { insertMindMap, hasMindMap, appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import {
  summarizeNote,
  extractActionItems,
  rewriteForClarity,
  continueWriting,
  generateOutline,
  suggestTitle,
  fixSpelling,
} from '@/server/actions/ai-actions';
import { generateMindMap } from '@/server/actions/mind-map';

type Mode = 'summary' | 'actions' | 'rewrite' | 'outline' | 'title' | 'fix-spelling';

const META: Record<Mode, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  summary: { label: 'Summary', Icon: ScrollText },
  actions: { label: 'Action items', Icon: ListChecks },
  rewrite: { label: 'Rewrite for clarity', Icon: Wand2 },
  outline: { label: 'Outline', Icon: ListTree },
  title: { label: 'Suggest title', Icon: Heading1 },
  'fix-spelling': { label: 'Fix spelling & grammar', Icon: SpellCheck },
};

/**
 * Note-level AI actions. Renders a dropdown trigger and a result dialog.
 * Each mode hits a different server action; we display the response and
 * let the user copy or insert it into the note.
 */
export function NoteAiMenu({
  noteId,
  onInsert,
  canvasRef,
}: {
  noteId: string;
  onInsert?: (markdown: string) => void;
  canvasRef?: React.RefObject<CanvasNoteHandle | null>;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>('summary');
  const [result, setResult] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mapBuilding, setMapBuilding] = React.useState(false);
  const [continuing, setContinuing] = React.useState(false);

  const continueThought = async () => {
    setMenuOpen(false);
    const api = canvasRef?.current?.getExcalidrawApi();
    if (!api) {
      toast.error('Canvas not ready yet.');
      return;
    }
    // Pick the selected text element if any; otherwise the latest one
    // by `updated` timestamp. Skip empty elements.
    const elements = api
      .getSceneElements()
      .filter(
        (el) => el.type === 'text' && !el.isDeleted && (el as { text?: string }).text?.trim(),
      );
    if (elements.length === 0) {
      toast.error('Write something first \u2014 then I can continue from it.');
      return;
    }
    const state = api.getAppState();
    const selectedIds = state.selectedElementIds ?? {};
    const selected = elements.find((el) => selectedIds[el.id]);
    const target =
      selected ?? elements.reduce((a, b) => ((a.updated ?? 0) > (b.updated ?? 0) ? a : b));
    const prefix = (target as { text: string }).text.trim();
    if (prefix.length < 8) {
      toast.error('Need a few more words to continue from.');
      return;
    }
    setContinuing(true);
    const t = toast.loading('Continuing your thought\u2026');
    try {
      const out = await continueWriting({ noteId, prefix: prefix.slice(-2000) });
      if (!out) {
        toast.error('No continuation generated.', { id: t });
        return;
      }
      appendTextToScene(api, out, { focus: true });
      toast.success('Added.', { id: t });
    } catch (err) {
      toast.error((err as Error).message || 'Could not continue', { id: t });
    } finally {
      setContinuing(false);
    }
  };

  const buildMindMap = async () => {
    setMenuOpen(false);
    const api = canvasRef?.current?.getExcalidrawApi();
    if (!api) {
      toast.error('Canvas not ready yet.');
      return;
    }
    const replacing = hasMindMap(api);
    if (replacing) {
      const ok = window.confirm(
        'A mind map already exists on this canvas. Replace it with a fresh one based on the current note?',
      );
      if (!ok) return;
    }
    setMapBuilding(true);
    const t = toast.loading(replacing ? 'Regenerating mind map…' : 'Generating mind map…');
    try {
      const map = await generateMindMap(noteId);
      insertMindMap(api, map, { replace: replacing });
      toast.success(replacing ? 'Mind map regenerated.' : 'Mind map inserted.', { id: t });
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    } finally {
      setMapBuilding(false);
    }
  };

  const run = async (m: Mode) => {
    setMenuOpen(false);
    setMode(m);
    setOpen(true);
    setResult('');
    setLoading(true);
    try {
      const fn =
        m === 'summary'
          ? summarizeNote
          : m === 'actions'
            ? extractActionItems
            : m === 'rewrite'
              ? rewriteForClarity
              : m === 'outline'
                ? generateOutline
                : m === 'title'
                  ? suggestTitle
                  : fixSpelling;
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
            <ul className="bg-popover absolute right-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-lg border text-sm shadow-md">
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
              {canvasRef && (
                <li className="border-t">
                  <button
                    type="button"
                    disabled={continuing}
                    className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left disabled:opacity-60"
                    onClick={continueThought}
                  >
                    {continuing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PenLine className="size-4" />
                    )}
                    Continue this thought
                  </button>
                </li>
              )}
              {canvasRef && (
                <li className="border-t">
                  <button
                    type="button"
                    disabled={mapBuilding}
                    className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left disabled:opacity-60"
                    onClick={buildMindMap}
                  >
                    {mapBuilding ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Network className="size-4" />
                    )}
                    Generate mind map
                  </button>
                </li>
              )}
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

'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
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

type ModeKey = 'summary' | 'actions' | 'rewrite' | 'outline' | 'title' | 'fixSpelling';

const META: Record<Mode, { labelKey: ModeKey; Icon: React.ComponentType<{ className?: string }> }> =
  {
    summary: { labelKey: 'summary', Icon: ScrollText },
    actions: { labelKey: 'actions', Icon: ListChecks },
    rewrite: { labelKey: 'rewrite', Icon: Wand2 },
    outline: { labelKey: 'outline', Icon: ListTree },
    title: { labelKey: 'title', Icon: Heading1 },
    'fix-spelling': { labelKey: 'fixSpelling', Icon: SpellCheck },
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
  const t = useTranslations('editor.ai');
  const tModes = useTranslations('editor.ai.modes');
  const tToast = useTranslations('editor.ai.toast');
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
      toast.error(tToast('canvasNotReady'));
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
      toast.error(tToast('writeFirst'));
      return;
    }
    const state = api.getAppState();
    const selectedIds = state.selectedElementIds ?? {};
    const selected = elements.find((el) => selectedIds[el.id]);
    const target =
      selected ?? elements.reduce((a, b) => ((a.updated ?? 0) > (b.updated ?? 0) ? a : b));
    const prefix = (target as { text: string }).text.trim();
    if (prefix.length < 8) {
      toast.error(tToast('moreWordsNeeded'));
      return;
    }
    setContinuing(true);
    const tid = toast.loading(tToast('continuing'));
    try {
      const out = await continueWriting({ noteId, prefix: prefix.slice(-2000) });
      if (!out) {
        toast.error(tToast('noContinuation'), { id: tid });
        return;
      }
      appendTextToScene(api, out, { focus: true });
      toast.success(tToast('added'), { id: tid });
    } catch (err) {
      toast.error((err as Error).message || tToast('couldNotContinue'), { id: tid });
    } finally {
      setContinuing(false);
    }
  };

  const buildMindMap = async () => {
    setMenuOpen(false);
    const api = canvasRef?.current?.getExcalidrawApi();
    if (!api) {
      toast.error(tToast('canvasNotReady'));
      return;
    }
    const replacing = hasMindMap(api);
    if (replacing) {
      const ok = window.confirm(tToast('confirmReplaceMap'));
      if (!ok) return;
    }
    setMapBuilding(true);
    const tid = toast.loading(replacing ? tToast('regenMindMap') : tToast('genMindMap'));
    try {
      const map = await generateMindMap(noteId);
      insertMindMap(api, map, { replace: replacing });
      toast.success(replacing ? tToast('mindMapRegen') : tToast('mindMapInserted'), { id: tid });
    } catch (err) {
      toast.error((err as Error).message, { id: tid });
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
          {t('triggerLabel')}
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10"
              aria-label={t('closeMenu')}
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
                      <I className="size-4" /> {tModes(META[m].labelKey)}
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
                    {t('continueThought')}
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
                    {t('generateMindMap')}
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
              <Icon className="size-4" /> {tModes(META[mode].labelKey)}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-card min-h-[140px] whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed">
            {loading ? (
              <span className="text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {t('thinking')}
              </span>
            ) : (
              result || t('noOutput')
            )}
          </div>
          {!loading && result && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  toast.success(t('copied'));
                }}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
              >
                <Copy className="size-3.5" /> {t('copy')}
              </button>
              {onInsert && (
                <button
                  type="button"
                  onClick={() => {
                    onInsert(result);
                    setOpen(false);
                    toast.success(t('inserted'));
                  }}
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white"
                >
                  {t('insertIntoNote')}
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

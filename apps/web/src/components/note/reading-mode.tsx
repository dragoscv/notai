'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, X } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import type { CanvasNoteHandle } from '@notai/editor';

interface SceneElement {
  id: string;
  type: string;
  text?: string;
  fontSize?: number;
  isDeleted?: boolean;
  y?: number;
  x?: number;
  customData?: Record<string, unknown> | null;
}

interface ExApi {
  getSceneElements(): readonly SceneElement[];
}

interface RenderBlock {
  id: string;
  text: string;
  level: 'h1' | 'h2' | 'h3' | 'body';
}

function detectLevel(el: SceneElement): RenderBlock['level'] {
  const tagged = (el.customData as { style?: string } | null)?.style;
  if (tagged === 'h1' || tagged === 'h2' || tagged === 'h3') return tagged;
  const fs = el.fontSize ?? 16;
  if (fs >= 30) return 'h1';
  if (fs >= 22) return 'h2';
  if (fs >= 19) return 'h3';
  return 'body';
}

const FOOTNOTE_DEF = /^\s*\[\^(\w+)\]:\s*(.+)$/;
const FOOTNOTE_REF = /\[\^(\w+)\]/g;

/**
 * Extract `[^id]: text` definition lines and renumber the markers
 * in document order. Returns blocks with footnote definition lines
 * stripped, plus an ordered list of footnotes for end-of-page render.
 */
function processFootnotes(blocks: RenderBlock[]): {
  blocks: RenderBlock[];
  footnotes: Array<{ num: number; id: string; text: string }>;
} {
  const defs = new Map<string, string>();
  const cleaned: RenderBlock[] = [];
  for (const b of blocks) {
    const lines = b.text.split('\n');
    const kept: string[] = [];
    for (const line of lines) {
      const m = FOOTNOTE_DEF.exec(line);
      if (m && m[1] && m[2]) defs.set(m[1], m[2]);
      else kept.push(line);
    }
    const text = kept.join('\n').trim();
    if (text) cleaned.push({ ...b, text });
  }
  const order: string[] = [];
  for (const b of cleaned) {
    let m: RegExpExecArray | null;
    FOOTNOTE_REF.lastIndex = 0;
    while ((m = FOOTNOTE_REF.exec(b.text)) !== null) {
      const id = m[1];
      if (id && defs.has(id) && !order.includes(id)) order.push(id);
    }
  }
  const footnotes = order.map((id, i) => ({ num: i + 1, id, text: defs.get(id) ?? '' }));
  return { blocks: cleaned, footnotes };
}

function renderWithFootnotes(text: string, numById: Map<string, number>): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  FOOTNOTE_REF.lastIndex = 0;
  let key = 0;
  while ((m = FOOTNOTE_REF.exec(text)) !== null) {
    const id = m[1];
    const num = id ? numById.get(id) : undefined;
    if (m.index > last) out.push(text.slice(last, m.index));
    if (num) {
      out.push(
        <sup key={`fn-${key++}`}>
          <a href={`#fn-${num}`} className="text-primary no-underline">
            [{num}]
          </a>
        </sup>,
      );
    } else {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Reading mode: takes every text element on the canvas and renders
 * it as a clean, scrollable typed page. Sorted by `y` so the reading
 * order roughly mirrors the visual layout.
 *
 * Modal-ish full-screen overlay so the user can read without the
 * canvas chrome around it. Esc / button to close.
 */
export function ReadingMode({
  canvasRef,
  noteTitle,
}: {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
  noteTitle: string;
}) {
  const t = useTranslations('editor.readingMode');
  const [open, setOpen] = React.useState(false);
  const [blocks, setBlocks] = React.useState<RenderBlock[]>([]);
  const [todaySec, setTodaySec] = React.useState(0);

  // Persist daily reading-mode time so the user can see a small "12 min today" goal chip.
  const todayKey = React.useMemo(() => {
    const d = new Date();
    return `notai:read-time:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(todayKey);
      if (raw) setTodaySec(Math.max(0, parseInt(raw, 10) || 0));
    } catch {
      /* ignore */
    }
  }, [todayKey]);
  React.useEffect(() => {
    if (!open) return;
    const h = window.setInterval(() => {
      setTodaySec((s) => {
        const next = s + 1;
        try {
          window.localStorage.setItem(todayKey, String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(h);
  }, [open, todayKey]);
  const goalSec = 600;
  const reached = todaySec >= goalSec;

  const refresh = React.useCallback(() => {
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) {
      setBlocks([]);
      return;
    }
    const list: Array<RenderBlock & { y: number }> = [];
    for (const el of api.getSceneElements()) {
      if (el.isDeleted) continue;
      if (el.type !== 'text') continue;
      const t = (el.text ?? '').trim();
      if (!t) continue;
      list.push({ id: el.id, text: t, level: detectLevel(el), y: el.y ?? 0 });
    }
    list.sort((a, b) => a.y - b.y);
    setBlocks(list);
  }, [canvasRef]);

  React.useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title={t('titleSuffix', {
          minutes: Math.floor(todaySec / 60),
          goal: reached
            ? t('titleGoalReached')
            : t('titleGoalRemaining', { minutes: Math.floor(goalSec / 60) }),
        })}
      >
        <BookOpen className="size-3.5" />
        {t('trigger')}
        {reached && <span className="ml-1 text-amber-500">✨</span>}
      </Button>
      {open && (
        <div className="bg-background fixed inset-0 z-[150] overflow-y-auto">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('closeAria')}
            className="text-muted-foreground hover:text-foreground bg-card hover:bg-accent fixed right-4 top-4 z-10 grid size-9 place-items-center rounded-full border shadow-sm"
          >
            <X className="size-4" />
          </button>
          <article className="prose dark:prose-invert mx-auto max-w-2xl px-6 py-16">
            <h1>{noteTitle || t('untitled')}</h1>
            {blocks.length === 0 ? (
              <p className="text-muted-foreground italic">{t('emptyNote')}</p>
            ) : (
              (() => {
                const { blocks: cleaned, footnotes } = processFootnotes(blocks);
                const numById = new Map(footnotes.map((f) => [f.id, f.num]));
                return (
                  <>
                    {cleaned.map((b) =>
                      b.level === 'h1' ? (
                        <h2 key={b.id}>{renderWithFootnotes(b.text, numById)}</h2>
                      ) : b.level === 'h2' ? (
                        <h3 key={b.id}>{renderWithFootnotes(b.text, numById)}</h3>
                      ) : b.level === 'h3' ? (
                        <h4 key={b.id}>{renderWithFootnotes(b.text, numById)}</h4>
                      ) : (
                        <p key={b.id} className="whitespace-pre-wrap">
                          {renderWithFootnotes(b.text, numById)}
                        </p>
                      ),
                    )}
                    {footnotes.length > 0 && (
                      <>
                        <hr />
                        <ol className="text-sm">
                          {footnotes.map((f) => (
                            <li key={f.id} id={`fn-${f.num}`}>
                              {f.text}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </>
                );
              })()
            )}
          </article>
        </div>
      )}
    </>
  );
}

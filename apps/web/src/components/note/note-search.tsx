'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@notai/ui/components/input';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import type { CanvasNoteHandle } from '@notai/editor';

interface SearchHit {
  id: string;
  text: string;
  excerpt: string;
}

interface SceneElement {
  id: string;
  type: string;
  text?: string;
  isDeleted?: boolean;
}

interface AppState {
  selectedElementIds?: Record<string, boolean>;
}

interface ExApi {
  getSceneElements(): readonly SceneElement[];
  getAppState(): AppState;
  updateScene(input: { appState: AppState }): void;
  scrollToContent(
    target: SceneElement | readonly SceneElement[],
    opts: { fitToContent?: boolean; animate?: boolean; duration?: number },
  ): void;
}

const MAX_RESULTS = 50;

/**
 * Cmd/Ctrl+F overlay for the current note. Searches across every
 * non-deleted text element in the Excalidraw scene; clicking a result
 * scrolls + selects it. Cmd+F when the overlay is already open just
 * re-focuses the input rather than swallowing the next keystroke.
 */
export function NoteSearch({ canvasRef }: { canvasRef: React.RefObject<CanvasNoteHandle | null> }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  useHotkey('mod+f', (e) => {
    // Only intercept when actively editing a note. Other pages keep
    // the browser\u2019s native find.
    e.preventDefault();
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  });

  useHotkey('escape', () => {
    if (open) setOpen(false);
  });

  const [hits, setHits] = React.useState<SearchHit[]>([]);

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) {
      setHits([]);
      return;
    }
    const needle = query.trim().toLowerCase();
    const elements = api.getSceneElements();
    const out: SearchHit[] = [];
    for (const el of elements) {
      if (el.isDeleted) continue;
      if (el.type !== 'text') continue;
      const text = el.text ?? '';
      const idx = text.toLowerCase().indexOf(needle);
      if (idx < 0) continue;
      const start = Math.max(0, idx - 20);
      const end = Math.min(text.length, idx + needle.length + 30);
      out.push({
        id: el.id,
        text,
        excerpt:
          (start > 0 ? '\u2026' : '') +
          text.slice(start, end) +
          (end < text.length ? '\u2026' : ''),
      });
      if (out.length >= MAX_RESULTS) break;
    }
    setHits(out);
  }, [open, query, canvasRef]);

  const jumpTo = (hit: SearchHit) => {
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) return;
    const el = api.getSceneElements().find((e) => e.id === hit.id);
    if (!el) return;
    api.updateScene({ appState: { selectedElementIds: { [hit.id]: true } } });
    api.scrollToContent(el, { fitToContent: true, animate: true, duration: 280 });
  };

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 mx-auto flex max-w-lg justify-center px-3">
      <div className="bg-card pointer-events-auto w-full overflow-hidden rounded-xl border shadow-xl">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="text-muted-foreground size-4" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in note\u2026"
            className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
            autoFocus
          />
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {query.trim().length >= 2 ? hits.length : ''}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close find"
            className="text-muted-foreground hover:text-foreground -m-1 p-1"
          >
            <X className="size-4" />
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="max-h-72 overflow-y-auto py-1">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(h)}
                  className="hover:bg-accent flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm"
                >
                  <span className="line-clamp-2">{h.excerpt}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && hits.length === 0 && (
          <p className="text-muted-foreground px-3 py-3 text-xs">No matches in this note.</p>
        )}
      </div>
    </div>
  );
}

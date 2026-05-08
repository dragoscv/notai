'use client';
import * as React from 'react';
import * as Y from 'yjs';
import type { Editor } from '@tiptap/react';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import type {
  OrderedExcalidrawElement,
  ExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { cn } from '@notai/lib/utils';
import { TextBlock } from './text-block';
import {
  addBlock,
  deleteBlockAt,
  getBlockFragment,
  getBlocksArray,
  migrateLegacyDoc,
  updateBlockAt,
  type SceneBlock,
} from './migrate-doc';

export type { ExcalidrawImperativeAPI };

/* -------------------------------------------------------------------- */
/* Excalidraw lazy import (client-only)                                   */
/* -------------------------------------------------------------------- */

const ExcalidrawComp = React.lazy(async () => {
  const mod = await import('@excalidraw/excalidraw');
  await import('@excalidraw/excalidraw/index.css');
  excalidrawHelpers = {
    reconcileElements: mod.reconcileElements,
    restoreElements: mod.restoreElements,
    CaptureUpdateAction: mod.CaptureUpdateAction,
  };
  return { default: mod.Excalidraw };
});

let excalidrawHelpers: {
  reconcileElements: typeof import('@excalidraw/excalidraw').reconcileElements;
  restoreElements: typeof import('@excalidraw/excalidraw').restoreElements;
  CaptureUpdateAction: typeof import('@excalidraw/excalidraw').CaptureUpdateAction;
} | null = null;

const EXCALIDRAW_MAP = 'excalidraw';
const ELEMENTS_FIELD = 'elements';

type AnyElement = OrderedExcalidrawElement | ExcalidrawElement;

function getElementsFromDoc(doc: Y.Doc): AnyElement[] {
  const map = doc.getMap(EXCALIDRAW_MAP);
  const raw = map.get(ELEMENTS_FIELD);
  return Array.isArray(raw) ? (raw as AnyElement[]) : [];
}

function writeElementsToDoc(doc: Y.Doc, elements: readonly AnyElement[]): void {
  doc.transact(() => {
    const map = doc.getMap(EXCALIDRAW_MAP);
    map.set(ELEMENTS_FIELD, JSON.parse(JSON.stringify(elements)) as AnyElement[]);
  }, 'local-excalidraw');
}

/* -------------------------------------------------------------------- */
/* Public API                                                             */
/* -------------------------------------------------------------------- */

export interface CanvasNoteHandle {
  /** Editor for the most recently focused text block, or null. */
  getFocusedEditor: () => Editor | null;
  /** Subscribe to focused-editor changes (e.g. to drive a shared toolbar). */
  subscribeFocused: (cb: (e: Editor | null) => void) => () => void;
  /** Insert content at the focused editor; if none, create a new block at viewport center. */
  insertContent: (content: string | Record<string, unknown>) => boolean;
  /** Add a new empty text block at the current viewport center. */
  addTextBlock: () => string | null;
  /** Raw Excalidraw API (e.g. for PDF import). */
  getExcalidrawApi: () => ExcalidrawImperativeAPI | null;
}

export interface CanvasNoteProps {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
  /** When true, no editing tools are shown; ctrl+wheel zoom + pan still work. */
  readOnly?: boolean;
  /** Sticky preset: hides Excalidraw chrome, fits content on first paint. */
  stickyMode?: boolean;
  className?: string;
  searchBacklinks?: (q: string) => Promise<Array<{ id: string; title: string }>>;
  /** Page-template background drawn behind the (transparent) Excalidraw canvas. */
  surface?: 'plain' | 'ruled' | 'grid' | 'dots' | 'columns';
  surfaceSpacing?: number;
  theme?: 'light' | 'dark';
  /** Persist viewport pan/zoom under this localStorage key (per-device). */
  viewportKey?: string;
}

/* -------------------------------------------------------------------- */
/* Component                                                              */
/* -------------------------------------------------------------------- */

export const CanvasNote = React.forwardRef<CanvasNoteHandle, CanvasNoteProps>(function CanvasNote(
  {
    doc,
    provider,
    user,
    readOnly = false,
    stickyMode = false,
    className,
    searchBacklinks,
    surface,
    surfaceSpacing = 32,
    theme,
    viewportKey,
  },
  ref,
) {
  const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null);
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);
  const resolvedTheme = useResolvedTheme(theme);

  /* ---------- Migration on first mount ---------- */
  React.useEffect(() => {
    migrateLegacyDoc(doc);
  }, [doc]);

  /* ---------- Block list (subscribe to Y.Array) ---------- */
  const blocks = useBlocksArray(doc);

  /* ---------- Viewport (zoom / scroll / active tool) ---------- */
  const persistedViewport = React.useMemo(() => readViewport(viewportKey), [viewportKey]);
  const [viewport, setViewport] = React.useState<Viewport>(
    () =>
      persistedViewport ?? {
        zoom: 1,
        scrollX: 0,
        scrollY: 0,
        activeTool: 'selection',
      },
  );
  const viewportDirtyRef = React.useRef(!!persistedViewport);

  // Subscribe to Excalidraw onChange (throttled with rAF) to mirror viewport.
  React.useEffect(() => {
    if (!api) return;
    let rafHandle = 0;
    const unsub = api.onChange((_els, appState) => {
      cancelAnimationFrame(rafHandle);
      rafHandle = requestAnimationFrame(() => {
        const z = appState.zoom?.value ?? 1;
        setViewport((prev) => {
          const tool = appState.activeTool?.type ?? 'selection';
          if (
            prev.zoom === z &&
            prev.scrollX === appState.scrollX &&
            prev.scrollY === appState.scrollY &&
            prev.activeTool === tool
          ) {
            return prev;
          }
          return {
            zoom: z,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            activeTool: tool,
          };
        });
      });
    });
    return () => {
      unsub();
      cancelAnimationFrame(rafHandle);
    };
  }, [api]);

  /* ---------- Persist viewport (pan/zoom) ---------- */
  React.useEffect(() => {
    if (!viewportKey || !api) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = api.onChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const s = api.getAppState();
        writeViewport(viewportKey, {
          zoom: s.zoom?.value ?? 1,
          scrollX: s.scrollX,
          scrollY: s.scrollY,
          activeTool: 'selection',
        });
        viewportDirtyRef.current = true;
      }, 250);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [api, viewportKey]);

  /* ---------- Excalidraw scene Y sync (ported verbatim) ---------- */
  const initialData = React.useMemo<ExcalidrawInitialDataState>(
    () =>
      ({
        elements: getElementsFromDoc(doc) as OrderedExcalidrawElement[],
        appState: {
          viewBackgroundColor: 'transparent',
          ...(persistedViewport && !stickyMode
            ? {
                scrollX: persistedViewport.scrollX,
                scrollY: persistedViewport.scrollY,
                zoom: { value: persistedViewport.zoom },
              }
            : {}),
        },
        scrollToContent: false,
      }) as ExcalidrawInitialDataState,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sigOf = React.useCallback((els: readonly AnyElement[]): string => {
    let h = els.length;
    for (const e of els) {
      const v = (e as { versionNonce?: number }).versionNonce ?? 0;
      h = ((h * 31) ^ v) >>> 0;
    }
    return `${els.length}:${h}`;
  }, []);
  const lastSigRef = React.useRef<string>('');
  React.useEffect(() => {
    lastSigRef.current = sigOf(initialData.elements ?? []);
  }, [initialData, sigOf]);

  const writeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleExcalidrawChange = React.useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      if (readOnly) return;
      const sig = sigOf(elements);
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      writeTimerRef.current = setTimeout(() => {
        writeTimerRef.current = null;
        writeElementsToDoc(doc, elements);
      }, 60);
    },
    [doc, readOnly, sigOf],
  );

  React.useEffect(() => {
    if (!api) return;
    const yMap = doc.getMap(EXCALIDRAW_MAP);
    const onYChange = (_ev: unknown, transaction: { origin: unknown }) => {
      if (transaction.origin === 'local-excalidraw') return;
      const next = yMap.get(ELEMENTS_FIELD);
      if (!Array.isArray(next)) return;
      const remote = next as OrderedExcalidrawElement[];
      const sig = sigOf(remote);
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;
      const helpers = excalidrawHelpers;
      if (!helpers) {
        api.updateScene({ elements: remote });
        return;
      }
      const localEls = api.getSceneElementsIncludingDeleted();
      const localApp = api.getAppState();
      const restored = helpers.restoreElements(remote, null);
      const reconciled = helpers.reconcileElements(
        localEls,
        restored as unknown as Parameters<typeof helpers.reconcileElements>[1],
        localApp,
      );
      api.updateScene({
        elements: reconciled,
        captureUpdate: helpers.CaptureUpdateAction.NEVER,
      });
    };
    yMap.observe(onYChange);
    return () => yMap.unobserve(onYChange);
  }, [api, doc, sigOf]);

  React.useEffect(() => {
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, []);

  /* ---------- Sticky/readOnly auto-fit on resize ---------- */
  React.useEffect(() => {
    if (!api || !stickyMode || !host) return;
    if (typeof ResizeObserver === 'undefined') return;

    let raf = 0;
    let succeededOnce = false;
    const fit = (): boolean => {
      cancelAnimationFrame(raf);
      let ok = false;
      raf = requestAnimationFrame(() => {
        api.refresh();
        const els = api.getSceneElementsIncludingDeleted();
        ok = fitStickyViewport(api, host, els);
        if (ok) succeededOnce = true;
      });
      return ok;
    };

    fit();

    const ro = new ResizeObserver(() => {
      if (!stickyMode && viewportDirtyRef.current) {
        api.refresh();
        return;
      }
      fit();
    });
    ro.observe(host);

    // MutationObserver on the blocks layer: re-fit whenever a text block
    // mounts or its rendered height changes (e.g. content streams in
    // from realtime).
    const blocksLayer = host.querySelector<HTMLElement>('[data-blocks-layer]');
    const mo = blocksLayer
      ? new MutationObserver(() => {
          fit();
        })
      : null;
    mo?.observe(blocksLayer!, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
      characterData: true,
    });

    // Polling fallback for the first ~3s in case neither RO nor MO fires
    // before the host has real dimensions / blocks have rendered.
    const interval = setInterval(() => {
      if (succeededOnce) {
        clearInterval(interval);
        return;
      }
      fit();
    }, 120);
    const stopPolling = setTimeout(() => clearInterval(interval), 3000);

    return () => {
      ro.disconnect();
      mo?.disconnect();
      cancelAnimationFrame(raf);
      clearInterval(interval);
      clearTimeout(stopPolling);
    };
  }, [api, stickyMode, host]);

  /* ---------- Sticky: refit when block list changes (e.g. realtime) ---------- */
  React.useEffect(() => {
    if (!api || !stickyMode || !host) return;
    const id = requestAnimationFrame(() => {
      const els = api.getSceneElementsIncludingDeleted();
      fitStickyViewport(api, host, els);
    });
    return () => cancelAnimationFrame(id);
  }, [api, stickyMode, host, blocks]);

  /* ---------- Focused editor tracking ---------- */
  const focusedRef = React.useRef<Editor | null>(null);
  const focusListenersRef = React.useRef(new Set<(e: Editor | null) => void>());
  const handleBlockFocus = React.useCallback((editor: Editor | null) => {
    focusedRef.current = editor;
    focusListenersRef.current.forEach((cb) => cb(editor));
  }, []);

  /* ---------- Imperative handle ---------- */
  React.useImperativeHandle(
    ref,
    () => ({
      getFocusedEditor: () => focusedRef.current,
      subscribeFocused: (cb) => {
        focusListenersRef.current.add(cb);
        cb(focusedRef.current);
        return () => focusListenersRef.current.delete(cb);
      },
      insertContent: (content) => {
        const ed = focusedRef.current;
        if (ed) {
          ed.chain().focus().insertContent(content).run();
          return true;
        }
        return false;
      },
      addTextBlock: () => {
        if (readOnly) return null;
        const center = viewportCenterWorld(api, host);
        const block = addBlock(doc, { x: center.x - 380, y: center.y - 24 });
        return block.id;
      },
      getExcalidrawApi: () => api,
    }),
    [api, doc, host, readOnly],
  );

  /* ---------- Active-tool gating for blocks ---------- */
  // Blocks are interactive only in selection mode (clicking text edits it).
  // In hand mode you pan; in any drawing tool you draw on top of blocks.
  const blocksInteractive = !readOnly && viewport.activeTool === 'selection';

  /* ---------- Render ---------- */
  return (
    <div
      ref={setHost}
      className={cn(
        'canvas-note relative h-full w-full overflow-hidden',
        stickyMode && 'canvas-note--sticky',
        readOnly && 'canvas-note--readonly',
        className,
      )}
      data-surface={surface}
      style={
        surface ? ({ '--paper-spacing': `${surfaceSpacing}px` } as React.CSSProperties) : undefined
      }
    >
      {/* Excalidraw owns world coordinates, zoom, pan, and tool state. */}
      <div className="excalidraw-transparent absolute inset-0" data-canvas-layer>
        <React.Suspense fallback={null}>
          <ExcalidrawComp
            initialData={initialData}
            excalidrawAPI={(r: ExcalidrawImperativeAPI) => setApi(r)}
            onChange={handleExcalidrawChange}
            viewModeEnabled={readOnly}
            zenModeEnabled={stickyMode}
            theme={resolvedTheme}
            handleKeyboardGlobally={false}
            UIOptions={
              stickyMode || readOnly
                ? {
                    canvasActions: {
                      changeViewBackgroundColor: false,
                      clearCanvas: false,
                      export: false,
                      loadScene: false,
                      saveAsImage: false,
                      saveToActiveFile: false,
                      toggleTheme: false,
                    },
                  }
                : undefined
            }
          />
        </React.Suspense>
      </div>

      {/* Blocks layer — same world transform as Excalidraw. Excalidraw's
          screen→world: screenX = (worldX + scrollX) * zoom. We replicate
          that with `scale(zoom) translate(scrollX, scrollY)`. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `translate(${viewport.scrollX * viewport.zoom}px, ${
            viewport.scrollY * viewport.zoom
          }px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
        data-blocks-layer
      >
        {blocks.map((block, idx) => (
          <BlockFrame
            key={block.id}
            block={block}
            index={idx}
            doc={doc}
            provider={provider}
            user={user}
            interactive={blocksInteractive}
            readOnly={readOnly}
            zoom={viewport.zoom}
            onFocusEditor={handleBlockFocus}
            searchBacklinks={searchBacklinks}
          />
        ))}
      </div>

      {/* Floating "Add text block" pill (authoring only). */}
      {!readOnly && !stickyMode && (
        <button
          type="button"
          className="bg-card/85 hover:bg-accent text-foreground/80 hover:text-accent-foreground absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur transition"
          onClick={() => {
            if (!api || !host) return;
            const center = viewportCenterWorld(api, host);
            addBlock(doc, { x: center.x - 380, y: center.y - 24 });
          }}
          title="Add a new text block at the current view"
        >
          <Plus className="size-3" /> Text
        </button>
      )}
    </div>
  );
});

/* -------------------------------------------------------------------- */
/* Block frame                                                            */
/* -------------------------------------------------------------------- */

interface BlockFrameProps {
  block: SceneBlock;
  index: number;
  doc: Y.Doc;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
  interactive: boolean;
  readOnly: boolean;
  zoom: number;
  onFocusEditor: (e: Editor | null) => void;
  searchBacklinks?: (q: string) => Promise<Array<{ id: string; title: string }>>;
}

function BlockFrame({
  block,
  index,
  doc,
  provider,
  user,
  interactive,
  readOnly,
  zoom,
  onFocusEditor,
  searchBacklinks,
}: BlockFrameProps) {
  const fragment = React.useMemo(() => getBlockFragment(doc, block.id), [doc, block.id]);
  const [hovered, setHovered] = React.useState(false);

  const onDragHandle = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const start = block;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / zoom;
      const dy = (ev.clientY - startClientY) / zoom;
      updateBlockAt(doc, index, { ...start, x: start.x + dx, y: start.y + dy });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const onResizeHandle = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startWidth = block.width;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / zoom;
      const w = Math.max(180, Math.round(startWidth + dx));
      updateBlockAt(doc, index, { ...block, width: w });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  return (
    <div
      data-block-id={block.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.width,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      className={cn('group rounded-md', interactive && 'hover:ring-primary/30 hover:ring-1')}
    >
      <TextBlock
        fragment={fragment}
        provider={provider}
        user={user}
        editable={!readOnly}
        searchBacklinks={searchBacklinks}
        onFocusEditor={onFocusEditor}
        className="block-content min-h-[1.5em] px-3 py-2"
      />

      {/* Hover chrome: drag handle + delete. Hidden in readOnly mode. */}
      {!readOnly && hovered && (
        <>
          <button
            type="button"
            aria-label="Drag block"
            title="Drag to move"
            onPointerDown={onDragHandle}
            className="bg-card/90 absolute -left-7 top-1 cursor-grab rounded border px-1 py-1 opacity-80 shadow-sm hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Delete block"
            title="Delete block"
            onClick={(e) => {
              e.stopPropagation();
              deleteBlockAt(doc, index);
            }}
            className="bg-card/90 absolute -right-7 top-1 rounded border px-1 py-1 opacity-80 shadow-sm hover:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
          <div
            onPointerDown={onResizeHandle}
            title="Resize"
            className="hover:bg-primary/40 absolute -right-1 bottom-2 top-2 w-1.5 cursor-ew-resize rounded"
          />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Helpers                                                                */
/* -------------------------------------------------------------------- */

interface Viewport {
  zoom: number;
  scrollX: number;
  scrollY: number;
  activeTool: string;
}

function useBlocksArray(doc: Y.Doc): SceneBlock[] {
  const arrRef = React.useRef<Y.Array<SceneBlock> | null>(null);
  if (!arrRef.current) arrRef.current = getBlocksArray(doc);

  const subscribe = React.useCallback(
    (cb: () => void) => {
      const arr = getBlocksArray(doc);
      arrRef.current = arr;
      arr.observe(cb);
      return () => arr.unobserve(cb);
    },
    [doc],
  );
  const get = React.useCallback(() => {
    const arr = arrRef.current ?? getBlocksArray(doc);
    return snapshot(arr);
  }, [doc]);

  return React.useSyncExternalStore(subscribe, get, get);
}

// Snapshot must be referentially stable when contents are unchanged.
const snapshotCache = new WeakMap<Y.Array<SceneBlock>, { sig: string; data: SceneBlock[] }>();
function snapshot(arr: Y.Array<SceneBlock>): SceneBlock[] {
  const data = arr.toArray();
  const sig = data.map((b) => `${b.id}:${b.x}:${b.y}:${b.width}`).join('|');
  const cached = snapshotCache.get(arr);
  if (cached && cached.sig === sig) return cached.data;
  snapshotCache.set(arr, { sig, data });
  return data;
}

function viewportCenterWorld(
  api: ExcalidrawImperativeAPI | null,
  host: HTMLElement | null,
): { x: number; y: number } {
  if (!api || !host) return { x: 0, y: 0 };
  const s = api.getAppState();
  const z = s.zoom?.value ?? 1;
  const rect = host.getBoundingClientRect();
  // screen center → world: (screenX/zoom) - scrollX
  return {
    x: rect.width / 2 / z - s.scrollX,
    y: rect.height / 2 / z - s.scrollY,
  };
}

interface PersistedViewport {
  zoom: number;
  scrollX: number;
  scrollY: number;
  activeTool: string;
}

/**
 * Centre + scale Excalidraw's viewport so the union of (1) every text
 * block (measured from the DOM, since their height auto-fits content)
 * and (2) every Excalidraw element fits inside the host with a small
 * margin. Used in sticky/read-only mode.
 *
 * Returns true when a fit was applied; false when there is nothing to
 * fit yet (host not laid out, no blocks rendered, etc.) so the caller
 * can retry.
 */
function fitStickyViewport(
  api: ExcalidrawImperativeAPI,
  host: HTMLElement,
  elements: readonly AnyElement[],
): boolean {
  const rect = host.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;

  const padding = 16;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const blockEls = host.querySelectorAll<HTMLElement>('[data-block-id]');
  for (const el of Array.from(blockEls)) {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 0 || h <= 0) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  for (const e of elements) {
    const ee = e as {
      isDeleted?: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    if (ee.isDeleted) continue;
    if (typeof ee.x !== 'number' || typeof ee.y !== 'number') continue;
    const w = ee.width ?? 0;
    const h = ee.height ?? 0;
    if (ee.x < minX) minX = ee.x;
    if (ee.y < minY) minY = ee.y;
    if (ee.x + w > maxX) maxX = ee.x + w;
    if (ee.y + h > maxY) maxY = ee.y + h;
  }

  // Nothing measurable yet — bail so the caller can retry.
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return false;
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  if (bboxW < 1 || bboxH < 1) return false;

  const availW = Math.max(1, rect.width - padding * 2);
  const availH = Math.max(1, rect.height - padding * 2);
  // Cap at 1 — never zoom IN past natural size; can scale down to fit.
  const zoom = Math.max(0.1, Math.min(availW / bboxW, availH / bboxH, 1));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scrollX = rect.width / (2 * zoom) - cx;
  const scrollY = rect.height / (2 * zoom) - cy;

  api.updateScene({
    appState: {
      scrollX,
      scrollY,
      zoom: { value: zoom as unknown as number },
    },
  } as Parameters<typeof api.updateScene>[0]);
  return true;
}

function readViewport(key: string | undefined): PersistedViewport | null {
  if (!key || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PersistedViewport>;
    if (
      typeof v.zoom !== 'number' ||
      typeof v.scrollX !== 'number' ||
      typeof v.scrollY !== 'number'
    ) {
      return null;
    }
    return {
      zoom: v.zoom,
      scrollX: v.scrollX,
      scrollY: v.scrollY,
      activeTool: typeof v.activeTool === 'string' ? v.activeTool : 'selection',
    };
  } catch {
    return null;
  }
}

function writeViewport(key: string, v: PersistedViewport): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* quota — ignore */
  }
}

const DARK_THEME_IDS = new Set(['midnight', 'oled', 'slate', 'rose', 'forest', 'mocha']);

function readDocumentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const html = document.documentElement;
  if (html.classList.contains('dark')) return 'dark';
  const dataTheme = html.getAttribute('data-theme');
  if (dataTheme && DARK_THEME_IDS.has(dataTheme)) return 'dark';
  return 'light';
}

function useResolvedTheme(explicit?: 'light' | 'dark'): 'light' | 'dark' {
  const [detected, setDetected] = React.useState<'light' | 'dark'>(() => readDocumentTheme());
  React.useEffect(() => {
    if (explicit) return;
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const read = () => setDetected(readDocumentTheme());
    read();
    const mo = new MutationObserver(read);
    mo.observe(html, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => mo.disconnect();
  }, [explicit]);
  return explicit ?? detected;
}

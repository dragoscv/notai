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
import { GripVertical, MessageCircle, Trash2 } from 'lucide-react';
import { cn } from '@notai/lib/utils';
import { TextBlock } from './text-block';
import { Minimap, type MinimapCorner } from './minimap';
import {
  addBlock,
  BLOCKS_CONTENT_MAP,
  BLOCKS_KEY,
  deleteBlockAt,
  LEGACY_BLOCK_ID,
  migrateLegacyDoc,
  peekBlockFragment,
  peekBlocksArray,
  SCENE_MAP,
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
  /** Optional: create a new note from a `[[…]]` autocomplete “Create” entry. */
  createBacklink?: (title: string) => Promise<{ id: string; title: string }>;
  /** Optional AI bridge — enables the `/ai` slash command bar inside text blocks. */
  aiContext?: import('./ai-types').SlashAiContext;
  /** Optional callback: open the comments panel anchored to this block. */
  onCommentBlock?: (blockId: string) => void;
  /** Page-template background drawn behind the (transparent) Excalidraw canvas. */
  surface?: 'plain' | 'ruled' | 'grid' | 'dots' | 'columns';
  surfaceSpacing?: number;
  theme?: 'light' | 'dark';
  /** Persist viewport pan/zoom under this localStorage key (per-device). */
  viewportKey?: string;
  /**
   * Minimap overlay. When `enabled`, shows a thumbnail of the note in
   * `corner`; clicks on the map pan the canvas. The minimap is also
   * draggable — `onMinimapCornerChange` is fired with the snapped
   * corner so the parent can persist the choice.
   */
  minimap?: { enabled: boolean; corner: MinimapCorner };
  onMinimapCornerChange?: (corner: MinimapCorner) => void;
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
    createBacklink,
    aiContext,
    onCommentBlock,
    surface,
    surfaceSpacing = 32,
    theme,
    viewportKey,
    minimap,
    onMinimapCornerChange,
  },
  ref,
) {
  const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null);
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);
  const resolvedTheme = useResolvedTheme(theme);

  /* ---------- Migration on first mount ----------
   * IMPORTANT: wait for the Hocuspocus provider to sync remote state
   * before running migration. Otherwise on a sticky window (or any
   * fresh client) we'd see an empty doc, create an empty block, and
   * then merge against the real legacy fragment when it arrives —
   * leaving a phantom empty block + an unreferenced legacy fragment,
   * which is exactly the "sticky shows nothing on first open" bug.
   */
  React.useEffect(() => {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      migrateLegacyDoc(doc);
    };
    // If the provider is already synced (cached doc, second mount, etc.)
    // run immediately; else wait for the synced event.
    const p = provider as unknown as {
      synced?: boolean;
      isSynced?: boolean;
      on?: (event: string, cb: () => void) => void;
      off?: (event: string, cb: () => void) => void;
    };
    if (p.synced || p.isSynced) {
      run();
      return;
    }
    const onSynced = () => run();
    p.on?.('synced', onSynced);
    // Safety net: 30s is generous on purpose. Notes are server-created so
    // there is always a remote doc to wait for; migrating prematurely on a
    // slow connection used to seed a fake UUID block whose local fragment
    // got orphaned the moment sync arrived ("blank on first refresh until
    // I do something" bug). 30s is well past any realistic sync window
    // while still recovering if the websocket truly never connects.
    const timer = setTimeout(run, 30000);
    return () => {
      clearTimeout(timer);
      p.off?.('synced', onSynced);
    };
  }, [doc, provider]);

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
  /*
   * Gate: do not write local Excalidraw state back to Y until we've had
   * a chance to seed the scene from Y. Otherwise the FIRST onChange that
   * Excalidraw fires after mount — with the empty `initialData.elements`
   * — schedules a 60ms-throttled write of `[]` that races our seed and
   * wipes the real elements from Y. The user saw a brief flash of
   * content then a permanently blank canvas. The gate flips true once
   * we have either populated the scene from Y, or confirmed (via the
   * provider's `synced` event) that Y is genuinely empty for this note.
   */
  const writeReadyRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    lastSigRef.current = sigOf(initialData.elements ?? []);
  }, [initialData, sigOf]);

  /*
   * Write strategy: THROTTLE, not debounce.
   *
   * Excalidraw fires onChange on every pointer move while drawing. With
   * a debounce-on-change, a continuous stroke kept resetting the timer
   * forever — no write fired until the user paused. If they refreshed
   * mid-draw (or right after letting go) the pending timer was killed
   * and the entire stroke was lost. That's the "I draw, refresh, and
   * everything disappears" bug.
   *
   * Throttle: write at most once per WRITE_THROTTLE_MS while a stream
   * of changes is in flight. Always flush a trailing write so the very
   * last frame is captured. Flush again on unmount + beforeunload so
   * an in-flight write is never lost on tab close.
   */
  const WRITE_THROTTLE_MS = 250;
  const pendingElementsRef = React.useRef<readonly OrderedExcalidrawElement[] | null>(null);
  const lastWriteAtRef = React.useRef<number>(0);
  const writeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushExcalidrawWrite = React.useCallback(() => {
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    const pending = pendingElementsRef.current;
    if (!pending) return;
    pendingElementsRef.current = null;
    lastWriteAtRef.current = Date.now();
    writeElementsToDoc(doc, pending);
  }, [doc]);

  const handleExcalidrawChange = React.useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      if (readOnly) return;
      const sig = sigOf(elements);
      if (sig === lastSigRef.current) return;
      // Don't echo local-only mount noise back to Y before we've seeded.
      if (!writeReadyRef.current) {
        lastSigRef.current = sig;
        return;
      }

      /*
       * SAFETY GUARD — never wipe a non-empty Y with a stale empty
       * onChange.
       *
       * Excalidraw fires onChange with whatever scene it has just
       * rendered. On cold mount that includes the empty `initialData`
       * scene, even when the Y.Doc has been populated by IDB or sync
       * before our seed could push elements via updateScene. Y.Map.set
       * is last-writer-wins per key, so writing an empty array here
       * trumps the server's real array on every other client — the
       * "I draw, refresh, sticky still shows it but main is blank, and
       * the next refresh of the sticky also goes blank" bug.
       *
       * If the user genuinely cleared the canvas, the next non-empty
       * stroke they make will write again and Y will catch up. We
       * deliberately accept that "select-all + delete" no longer
       * persists as an empty doc; that's a fair trade for never losing
       * content to a mount race.
       */
      if (elements.length === 0) {
        const yMap = doc.getMap(EXCALIDRAW_MAP);
        const current = yMap.get(ELEMENTS_FIELD);
        if (Array.isArray(current) && current.length > 0) {
          lastSigRef.current = sig;
          return;
        }
      }

      lastSigRef.current = sig;
      pendingElementsRef.current = elements;

      const now = Date.now();
      const since = now - lastWriteAtRef.current;
      if (since >= WRITE_THROTTLE_MS) {
        // Leading edge: write immediately so the first stroke can never
        // be lost by a fast refresh. This is the "autosave continuously"
        // guarantee: every stroke makes it to disk within ~one frame.
        flushExcalidrawWrite();
        return;
      }
      // Trailing edge: a write happened recently; coalesce until the
      // throttle window expires, then fire.
      if (writeTimerRef.current) return;
      writeTimerRef.current = setTimeout(() => {
        writeTimerRef.current = null;
        flushExcalidrawWrite();
      }, WRITE_THROTTLE_MS - since);
    },
    [doc, readOnly, sigOf, flushExcalidrawWrite],
  );

  // Flush pending writes when the tab/window is about to unload so a
  // refresh during a stroke doesn't drop the last frame.
  React.useEffect(() => {
    if (typeof window === 'undefined' || readOnly) return;
    const onBeforeUnload = () => flushExcalidrawWrite();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushExcalidrawWrite();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [readOnly, flushExcalidrawWrite]);

  React.useEffect(() => {
    if (!api) return;
    const yMap = doc.getMap(EXCALIDRAW_MAP);

    /*
     * SEED: when the api is first available, push whatever Excalidraw
     * elements are currently in the Y.Doc into the scene. This covers
     * the race where sync delivered `excalidraw.elements` BEFORE the
     * Excalidraw component finished mounting and called us back with
     * the api — the observer below would never fire for that change
     * and the canvas would render empty until the user drew something
     * (or more commonly, refreshed and saw nothing).
     */
    const seed = () => {
      const current = yMap.get(ELEMENTS_FIELD);
      if (!Array.isArray(current) || current.length === 0) return;
      const remote = current as OrderedExcalidrawElement[];
      const sig = sigOf(remote);
      // Pre-prime lastSigRef to the live Y signature BEFORE any
      // updateScene call. If Excalidraw subsequently fires a stale
      // onChange (e.g. with the empty initial scene from before our
      // updateScene took effect), the sig won't match the empty-stale
      // sig either, but the SAFETY GUARD in handleExcalidrawChange
      // will refuse to wipe Y. Combined, these two layers make the
      // race truly unhittable.
      lastSigRef.current = sig;
      const helpers = excalidrawHelpers;
      if (!helpers) {
        api.updateScene({ elements: remote });
        writeReadyRef.current = true;
        return;
      }
      const restored = helpers.restoreElements(remote, null);
      api.updateScene({
        elements: restored,
        captureUpdate: helpers.CaptureUpdateAction.NEVER,
      });
      writeReadyRef.current = true;
    };
    seed();
    // Belt & suspenders: also re-seed once the provider says it has
    // finished its initial sync, in case the elements key arrived in
    // a transaction between the seed() call above and now. After the
    // first sync we also unconditionally open the write gate — if Y
    // really is empty, any user edit from now on is legitimate.
    const p = provider as unknown as {
      synced?: boolean;
      isSynced?: boolean;
      on?: (event: string, cb: () => void) => void;
      off?: (event: string, cb: () => void) => void;
    };
    const onSynced = () => {
      seed();
      writeReadyRef.current = true;
    };
    if (p.synced || p.isSynced) {
      writeReadyRef.current = true;
    } else {
      p.on?.('synced', onSynced);
    }

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
    return () => {
      yMap.unobserve(onYChange);
      p.off?.('synced', onSynced);
    };
  }, [api, doc, provider, sigOf]);

  React.useEffect(() => {
    return () => {
      // Flush any pending throttled write so an unmount during a stroke
      // (route change, sticky window close, etc.) doesn't drop frames.
      flushExcalidrawWrite();
    };
  }, [flushExcalidrawWrite]);

  /* ---------- Sticky/readOnly auto-fit ----------
   *
   * The sticky window is meant to be a zoomed-out, read-only mirror of
   * the note as it looks when you open it. Auto-fit is fragile because
   * the things we measure arrive asynchronously:
   *
   *   1. Hocuspocus has to sync the Y.Doc.
   *   2. Migration creates the block array.
   *   3. Each TipTap editor mounts and renders its fragment — at this
   *      point the block's `offsetHeight` finally becomes its real
   *      height.
   *   4. Remote Excalidraw elements may arrive even later via Y observer.
   *
   * Strategy: poll until we get a measurable bbox, then FIT ONCE and
   * stop. Subsequent edits/draws don't refit — that was the "sticky
   * keeps zooming out while I draw" annoyance. The user can still pan
   * and zoom manually (ctrl+wheel + hand tool) and we don't fight them.
   *
   * The only exception is host resize: when the user drags the sticky
   * window itself, refit so content stays centred at the new size.
   */
  React.useEffect(() => {
    if (!api || !stickyMode || !host) return;

    let cancelled = false;
    let succeededOnce = false;
    let attempts = 0;

    const refit = (): boolean => {
      const els = api.getSceneElementsIncludingDeleted();
      return fitStickyViewport(api, host, els);
    };

    const poll = () => {
      if (cancelled || succeededOnce) return;
      attempts += 1;
      api.refresh();
      if (refit()) {
        succeededOnce = true;
        return;
      }
      // Cap polling at ~12s so a doc that's truly empty (no blocks, no
      // drawings) eventually stops. The sync-then-render path usually
      // resolves within ~500ms; the cap is just a safety net.
      if (attempts < 100) setTimeout(poll, 120);
    };
    poll();

    // Refit on host resize ONLY (window dragged/resized). Use rAF to
    // coalesce continuous resize ticks into a single fit per frame.
    let raf = 0;
    const hostRO =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!succeededOnce) {
              poll();
              return;
            }
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              api.refresh();
              refit();
            });
          })
        : null;
    hostRO?.observe(host);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      hostRO?.disconnect();
    };
  }, [api, stickyMode, host]);

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
        surface
          ? ({
              // Paper background follows Excalidraw's pan/zoom so ruled
              // lines / grid / dots / columns stay locked to world
              // coordinates — drawings never drift relative to the
              // background as you pan or zoom.
              '--paper-spacing': `${surfaceSpacing}px`,
              '--paper-scale': viewport.zoom,
              '--paper-offset-x': `${viewport.scrollX * viewport.zoom}px`,
              '--paper-offset-y': `${viewport.scrollY * viewport.zoom}px`,
            } as React.CSSProperties)
          : undefined
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
            createBacklink={createBacklink}
            aiContext={aiContext}
            onCommentBlock={onCommentBlock}
          />
        ))}
      </div>

      {/* Minimap overlay (authoring only). The corner is parent-controlled
          so it persists across reloads via the parent's settings store. */}
      {!stickyMode && minimap?.enabled && (
        <Minimap
          doc={doc}
          host={host}
          api={api}
          viewport={viewport}
          corner={minimap.corner}
          onCornerChange={(c) => onMinimapCornerChange?.(c)}
        />
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
  createBacklink?: (title: string) => Promise<{ id: string; title: string }>;
  aiContext?: import('./ai-types').SlashAiContext;
  onCommentBlock?: (blockId: string) => void;
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
  createBacklink,
  aiContext,
  onCommentBlock,
}: BlockFrameProps) {
  const fragment = useBlockFragment(doc, block.id);
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
      {fragment ? (
        <TextBlock
          // Re-mount TipTap whenever the underlying Y.XmlFragment reference
          // changes — this happens when sync replaces a lazily-bound local
          // fragment with the real remote one. Without the key, TipTap
          // stays bound to the orphaned reference and renders blank.
          key={fragmentKeyOf(fragment)}
          fragment={fragment}
          provider={provider}
          user={user}
          editable={!readOnly}
          searchBacklinks={searchBacklinks}
          createBacklink={createBacklink}
          aiContext={aiContext}
          onFocusEditor={onFocusEditor}
          className="block-content min-h-[1.5em] px-3 py-2"
        />
      ) : (
        <div
          className="text-muted-foreground/50 px-3 py-2 text-xs"
          aria-hidden
          // Placeholder while we wait for the remote blocks-content map
          // to deliver this block's fragment. Nothing to type into yet.
        >
          &nbsp;
        </div>
      )}
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
          {onCommentBlock && (
            <button
              type="button"
              aria-label="Comment on block"
              title="Comment on this block"
              onClick={(e) => {
                e.stopPropagation();
                onCommentBlock(block.id);
              }}
              className="bg-card/90 absolute -right-7 top-9 rounded border px-1 py-1 opacity-80 shadow-sm hover:opacity-100"
            >
              <MessageCircle className="size-3" />
            </button>
          )}
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
  /*
   * Subscribe to BOTH the scene map (for `blocks` key replacement) and
   * the current blocks Y.Array (for content changes). Why both?
   *
   * Hocuspocus sync replaces the local empty Y.Array with the remote
   * one — `scene.set('blocks', remoteArr)`. If we only observed the
   * local empty array, our subscription would never fire after sync
   * and the note would render blank until the user switched notes
   * (forcing a remount). Observing the scene map lets us detect the
   * replacement and re-attach to the new array.
   */
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const scene = doc.getMap(SCENE_MAP);
      let observedArr: Y.Array<SceneBlock> | null = null;

      const attach = (next: Y.Array<SceneBlock> | null) => {
        if (observedArr === next) return;
        if (observedArr) observedArr.unobserve(cb);
        observedArr = next;
        if (next) next.observe(cb);
      };

      attach(peekBlocksArray(doc));

      const onSceneChange = (ev: Y.YMapEvent<unknown>) => {
        if (!ev.keysChanged.has(BLOCKS_KEY)) return;
        attach(peekBlocksArray(doc));
        cb();
      };
      scene.observe(onSceneChange);

      return () => {
        scene.unobserve(onSceneChange);
        if (observedArr) observedArr.unobserve(cb);
      };
    },
    [doc],
  );

  const get = React.useCallback(() => {
    const arr = peekBlocksArray(doc);
    return arr ? snapshot(arr) : EMPTY_BLOCKS;
  }, [doc]);

  return React.useSyncExternalStore(subscribe, get, get);
}

const EMPTY_BLOCKS: SceneBlock[] = [];

/**
 * Subscribe to a single block's content fragment. Returns the current
 * Y.XmlFragment for the block id, or null while we're waiting for the
 * remote `blocks-content` map to deliver it.
 *
 * Why this is a hook rather than a memo: when Hocuspocus syncs the doc,
 * the remote fragment for this id arrives via `map.set(id, remoteFrag)`.
 * That REPLACES the reference. Components must observe the map and
 * re-resolve when the key changes, otherwise they stay bound to a
 * lazily-created local empty fragment that's no longer reachable from
 * the doc — that's the "blank on first refresh" bug.
 *
 * The legacy block id always resolves immediately (its content lives in
 * a top-level XmlFragment whose reference Yjs never replaces — peer edits
 * merge into it directly).
 */
function useBlockFragment(doc: Y.Doc, blockId: string): Y.XmlFragment | null {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      // Legacy fragment is stable; no observation needed.
      if (blockId === LEGACY_BLOCK_ID) return () => {};
      const map = doc.getMap(BLOCKS_CONTENT_MAP);
      const onChange = (ev: Y.YMapEvent<unknown>) => {
        if (ev.keysChanged.has(blockId)) cb();
      };
      map.observe(onChange);
      return () => map.unobserve(onChange);
    },
    [doc, blockId],
  );
  const get = React.useCallback(() => peekBlockFragment(doc, blockId), [doc, blockId]);
  return React.useSyncExternalStore(subscribe, get, get);
}

/**
 * Stable key for a Y.XmlFragment so React remounts TipTap when the
 * underlying reference is replaced by sync. Yjs assigns each shared
 * type a `_item` clock id under the hood; we fall back to object
 * identity through a WeakMap for fragments that don't expose one.
 */
const fragmentKeys = new WeakMap<Y.XmlFragment, string>();
let fragmentKeyCounter = 0;
function fragmentKeyOf(frag: Y.XmlFragment): string {
  let key = fragmentKeys.get(frag);
  if (!key) {
    fragmentKeyCounter += 1;
    key = `f${fragmentKeyCounter}`;
    fragmentKeys.set(frag, key);
  }
  return key;
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
 * and (2) every Excalidraw element fits inside the host with comfortable
 * padding. Used in sticky/read-only mode.
 *
 * The result is a "mirror" of the note that's slightly zoomed out so the
 * content has breathing room on every edge — it never zooms IN past the
 * note's natural 1× scale, only down to make everything fit.
 *
 * Returns true when a fit was applied; false when there is nothing to
 * fit yet (host not laid out, no blocks rendered, blocks still 0px tall
 * because TipTap hasn't mounted, etc.) so the caller can retry.
 */
function fitStickyViewport(
  api: ExcalidrawImperativeAPI,
  host: HTMLElement,
  elements: readonly AnyElement[],
): boolean {
  const rect = host.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;

  // Comfortable inset around the bbox so glyphs & ink don't kiss the edges.
  const padding = 24;
  // Extra zoom-out on top of the fit ratio so the sticky reads as a
  // "preview" of the note instead of a tightly-cropped thumbnail.
  const zoomOutFactor = 0.92;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const blockEls = host.querySelectorAll<HTMLElement>('[data-block-id]');
  let measurableBlocks = 0;
  for (const el of Array.from(blockEls)) {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 0 || h <= 0) continue;
    measurableBlocks += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  let measurableEls = 0;
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
    measurableEls += 1;
    if (ee.x < minX) minX = ee.x;
    if (ee.y < minY) minY = ee.y;
    if (ee.x + w > maxX) maxX = ee.x + w;
    if (ee.y + h > maxY) maxY = ee.y + h;
  }

  // If we found block elements in the DOM but none had real dimensions yet
  // (TipTap still mounting), bail so the ResizeObserver retry hits us as
  // soon as a block grows. Same if there's truly nothing to show.
  if (measurableBlocks === 0 && measurableEls === 0) return false;
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return false;

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  if (bboxW < 1 || bboxH < 1) return false;

  const availW = Math.max(1, rect.width - padding * 2);
  const availH = Math.max(1, rect.height - padding * 2);
  // Cap at 1 — never zoom IN past natural size; can scale down to fit.
  // Then apply the zoom-out factor for a little breathing room.
  const fitZoom = Math.min(availW / bboxW, availH / bboxH, 1);
  const zoom = Math.max(0.1, fitZoom * zoomOutFactor);

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

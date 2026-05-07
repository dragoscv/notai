'use client';
import * as React from 'react';
import type * as Y from 'yjs';
import type {
    ExcalidrawImperativeAPI,
    ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import type {
    OrderedExcalidrawElement,
    ExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import { cn } from '@notai/lib/utils';

// Re-export so consumer apps that don't directly depend on @excalidraw/excalidraw
// can still type `onReady` handlers.
export type { ExcalidrawImperativeAPI };

// Excalidraw is client-only (uses canvas APIs, window.matchMedia, etc.).
// We use React.lazy + an async module that also imports the CSS as a
// side-effect. The whole component is already behind `'use client'` and
// consumers wrap it in `next/dynamic({ ssr: false })`, so this cannot run
// on the server.
const ExcalidrawComp = React.lazy(async () => {
    const mod = await import('@excalidraw/excalidraw');
    await import('@excalidraw/excalidraw/index.css');
    // Cache the reconciliation helpers so the Y.Map observer can use them
    // synchronously once the component has mounted (they're only available
    // after Excalidraw itself is loaded).
    excalidrawHelpers = {
        reconcileElements: mod.reconcileElements,
        restoreElements: mod.restoreElements,
        CaptureUpdateAction: mod.CaptureUpdateAction,
    };
    return { default: mod.Excalidraw };
});

// Populated when Excalidraw finishes loading. Untyped to avoid pulling the
// internal `CaptureUpdateActionType` into the module-level signature.
let excalidrawHelpers: {
    reconcileElements: typeof import('@excalidraw/excalidraw').reconcileElements;
    restoreElements: typeof import('@excalidraw/excalidraw').restoreElements;
    CaptureUpdateAction: typeof import('@excalidraw/excalidraw').CaptureUpdateAction;
} | null = null;

export interface DrawingCanvasProps {
    doc: Y.Doc;
    className?: string;
    /** Force view-only (no editing tools, no selection). */
    readOnly?: boolean;
    /** When false, the canvas is visible but click-through so text below stays interactive. */
    interactive?: boolean;
    /** Hide Excalidraw's built-in UI (toolbar, menu). Useful for overlay mode. */
    hideUi?: boolean;
    /** Transparent canvas background (overlay on top of text editor). */
    transparent?: boolean;
    /** Optional callback with the Excalidraw imperative API once ready. */
    onReady?: (api: ExcalidrawImperativeAPI) => void;
    /** Theme: light/dark. Defaults to auto (follows system via CSS). */
    theme?: 'light' | 'dark';
    /**
     * Page-template background drawn behind the transparent canvas. Matches
     * the values accepted by the global `[data-surface]` CSS in the UI pkg:
     * plain | ruled | grid | dots | columns. Only rendered when `transparent`
     * is true (otherwise Excalidraw fills the background itself).
     */
    surface?: 'plain' | 'ruled' | 'grid' | 'dots' | 'columns';
    /** Spacing (px) for the surface pattern. Defaults to 32. */
    surfaceSpacing?: number;
    /**
     * Persist the Excalidraw viewport (scroll + zoom) under this localStorage
     * key, so reloading the note keeps the user where they were instead of
     * re-centering on content. Per-user / per-device state, so deliberately
     * not synced through Yjs.
     */
    viewportKey?: string;
    /**
     * External scroll offset (CSS px) applied to Excalidraw's scrollY. When
     * provided, this wins over persisted state and lets a parent scroll
     * container drive the canvas so text + drawings pan as one.
     */
    scrollTop?: number;
    /**
     * When `readOnly` is true Excalidraw defaults to fit-to-content so the
     * entire drawing is framed in the viewer. Set `fit={false}` to keep the
     * viewer at world (0,0) zoom=1 — required when rendering a pixel-perfect
     * mirror of the author's layout (e.g. sticky notes scaled via CSS).
     */
    fit?: boolean;
}

const Y_MAP_KEY = 'excalidraw';
const ELEMENTS_FIELD = 'elements';

type AnyElement = OrderedExcalidrawElement | ExcalidrawElement;

function getElementsFromDoc(doc: Y.Doc): AnyElement[] {
    const map = doc.getMap(Y_MAP_KEY);
    const raw = map.get(ELEMENTS_FIELD);
    if (!Array.isArray(raw)) return [];
    return raw as AnyElement[];
}

function writeElementsToDoc(doc: Y.Doc, elements: readonly AnyElement[], origin: unknown) {
    doc.transact(() => {
        const map = doc.getMap(Y_MAP_KEY);
        // Clone to plain JSON so Yjs stores primitives (not frozen objects).
        map.set(ELEMENTS_FIELD, JSON.parse(JSON.stringify(elements)) as AnyElement[]);
    }, origin);
}

/**
 * Excalidraw-backed drawing canvas, synced via Yjs.
 *
 * Sync model:
 *   - The authoritative element list lives in `doc.getMap('excalidraw')`
 *     under the key `elements` as a plain JSON array.
 *   - Local edits are debounced and written back to the Y.Map.
 *   - Remote Y.Map updates call `api.updateScene({ elements })` to rehydrate.
 *
 * We rely on Excalidraw's own version nonce (`versionNonce` on each element)
 * to detect meaningful changes — comparing array lengths + the hash of the
 * last seen local version keeps write traffic minimal.
 */
export function DrawingCanvas({
    doc,
    className,
    readOnly,
    interactive = true,
    hideUi = false,
    transparent = false,
    onReady,
    theme,
    surface,
    surfaceSpacing = 32,
    viewportKey,
    scrollTop,
    fit,
}: DrawingCanvasProps) {
    const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null);
    const [host, setHost] = React.useState<HTMLDivElement | null>(null);
    const resolvedTheme = useResolvedTheme(theme);

    // Read any persisted viewport synchronously so initialData has it on the
    // very first paint — otherwise Excalidraw would briefly render at (0,0)
    // before we could call `updateScene`.
    const persistedViewport = React.useMemo(() => readViewport(viewportKey), [viewportKey]);

    // Resolved auto-fit behaviour: readOnly viewers fit by default so the
    // whole drawing is visible; the caller can opt out with `fit={false}`.
    const autoFit = fit ?? readOnly ?? false;

    // Once the user has panned/zoomed (and we've persisted it), stop
    // overriding their viewport with fit-to-content on remote changes or
    // resize. `viewportDirtyRef` is flipped the first time we write.
    const viewportDirtyRef = React.useRef<boolean>(!!persistedViewport);

    // Snapshot used as Excalidraw's initialData. Taken once on mount; remote
    // updates after mount are applied via `updateScene`.
    const initialData = React.useMemo<ExcalidrawInitialDataState>(
        () =>
            ({
                elements: getElementsFromDoc(doc) as OrderedExcalidrawElement[],
                appState: {
                    viewBackgroundColor: transparent ? 'transparent' : '#ffffff',
                    // Priority:
                    //   1. Persisted viewport (if a viewportKey is provided
                    //      and we found saved state) — works for both author
                    //      and viewer, so a sticky remembers where the user
                    //      last panned/zoomed to.
                    //   2. autoFit readonly mode lets Excalidraw scroll-to-
                    //      content via `scrollToContent: true` below.
                    //   3. Mirror-mode readonly clamps to world origin.
                    //   4. Authoring default (no saved state): Excalidraw
                    //      picks its own.
                    ...(persistedViewport
                        ? {
                              scrollX: persistedViewport.scrollX,
                              scrollY: persistedViewport.scrollY,
                              zoom: { value: persistedViewport.zoom },
                          }
                        : readOnly && !autoFit
                          ? { scrollX: 0, scrollY: 0, zoom: { value: 1 } }
                          : {}),
                },
                scrollToContent: autoFit && !persistedViewport,
            }) as ExcalidrawInitialDataState,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // Signature of the last elements array we either wrote or applied from
    // remote — used to short-circuit echoes in both directions.
    const lastSigRef = React.useRef<string>('');
    const sigOf = React.useCallback((els: readonly AnyElement[]): string => {
        // versionNonce is a per-element monotonically-increasing number Excalidraw
        // bumps on every mutation. Hashing the concatenation is cheap and stable.
        let h = els.length;
        for (const e of els) {
            const v = (e as { versionNonce?: number }).versionNonce ?? 0;
            h = ((h * 31) ^ v) >>> 0;
        }
        return `${els.length}:${h}`;
    }, []);

    // Initialize the signature from the initial snapshot so we don't write
    // the same data right back to yjs on first `onChange`.
    React.useEffect(() => {
        lastSigRef.current = sigOf(initialData.elements ?? []);
    }, [initialData, sigOf]);

    // onChange → debounced Y.Map write. 60 ms is fast enough to feel live
    // during a drag while still coalescing the ~60Hz onChange storm into a
    // handful of Yjs ops per second.
    const writeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleChange = React.useCallback(
        (elements: readonly OrderedExcalidrawElement[]) => {
            if (readOnly) return; // viewers never write back
            const sig = sigOf(elements);
            if (sig === lastSigRef.current) return;
            lastSigRef.current = sig;
            if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
            writeTimerRef.current = setTimeout(() => {
                writeTimerRef.current = null;
                writeElementsToDoc(doc, elements, 'local-excalidraw');
            }, 60);
        },
        [doc, sigOf, readOnly],
    );

    // Observe remote Y.Map changes → reconcile into Excalidraw.
    //
    // Using `reconcileElements` + `CaptureUpdateAction.NEVER` is the official
    // collab pattern (mirrors excalidraw.com's Firebase bridge). Without it,
    // `updateScene` runs through history capture and Excalidraw's version
    // tie-break can silently drop remote updates that share IDs with local
    // elements — which is exactly what caused the sticky viewer to show a
    // stale drawing.
    React.useEffect(() => {
        if (!api) return;
        const yMap = doc.getMap(Y_MAP_KEY);
        const onChange = (_ev: unknown, transaction: { origin: unknown }) => {
            if (transaction.origin === 'local-excalidraw') return;
            const next = yMap.get(ELEMENTS_FIELD);
            if (!Array.isArray(next)) return;
            const remote = next as OrderedExcalidrawElement[];
            const sig = sigOf(remote);
            if (sig === lastSigRef.current) return;
            lastSigRef.current = sig;

            const helpers = excalidrawHelpers;
            if (!helpers) {
                // Excalidraw hasn't mounted yet — no local state to reconcile
                // against, just seed the scene.
                api.updateScene({ elements: remote });
                return;
            }

            const localElements = api.getSceneElementsIncludingDeleted();
            const localAppState = api.getAppState();
            // Restore normalizes JSON-serialized elements back into the shape
            // Excalidraw expects (fills defaults, re-wires refs, etc).
            const restored = helpers.restoreElements(remote, null);
            const reconciled = helpers.reconcileElements(
                localElements,
                restored as unknown as Parameters<typeof helpers.reconcileElements>[1],
                localAppState,
            );
            api.updateScene({
                elements: reconciled,
                captureUpdate: helpers.CaptureUpdateAction.NEVER,
            });
            if (autoFit && !viewportDirtyRef.current) {
                requestAnimationFrame(() =>
                    api.scrollToContent(undefined, { fitToContent: true, animate: false }),
                );
            }
        };
        yMap.observe(onChange);
        return () => yMap.unobserve(onChange);
    }, [api, doc, sigOf, autoFit]);

    // Refit on resize for readonly viewers that use auto-fit (e.g. plain
    // sticky window mode). Mirror-mode viewers (fit=false) skip this because
    // their layout is already scaled by CSS transforms.
    React.useEffect(() => {
        if (!api || !autoFit || !host) return;
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            if (viewportDirtyRef.current) {
                api.refresh();
                return;
            }
            api.refresh();
            requestAnimationFrame(() =>
                api.scrollToContent(undefined, { fitToContent: true, animate: false }),
            );
        });
        ro.observe(host);
        return () => ro.disconnect();
    }, [api, autoFit, host]);

    // Cleanup pending write on unmount.
    React.useEffect(() => {
        return () => {
            if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
        };
    }, []);

    // Drive Excalidraw's scrollY from an external scroll container (the text
    // editor column). scrollTop is in CSS px; Excalidraw's scrollY is in
    // world units, so we divide by the current zoom. This keeps drawings
    // pinned to the text underneath them when the user scrolls the note.
    React.useEffect(() => {
        if (!api || scrollTop === undefined || readOnly) return;
        const zoom = api.getAppState().zoom?.value ?? 1;
        api.updateScene({
            appState: { scrollY: -scrollTop / zoom },
            captureUpdate: excalidrawHelpers?.CaptureUpdateAction.NEVER,
        });
    }, [api, scrollTop, readOnly]);

    // Persist viewport (scroll + zoom) locally, debounced. Per-user /
    // per-device so we deliberately don't round-trip through Yjs. Enabled
    // whenever the caller provides a `viewportKey` — including readonly
    // viewers like sticky notes that want to remember their pan/zoom.
    React.useEffect(() => {
        if (!api || !viewportKey) return;
        let raf = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const unsub = api.onChange(() => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    const s = api.getAppState();
                    writeViewport(viewportKey, {
                        scrollX: s.scrollX,
                        scrollY: s.scrollY,
                        zoom: s.zoom?.value ?? 1,
                    });
                    viewportDirtyRef.current = true;
                });
            }, 200);
        });
        return () => {
            unsub();
            if (timer) clearTimeout(timer);
            cancelAnimationFrame(raf);
        };
        // `readOnly` is intentionally included so swapping view modes
        // re-subscribes; also keeps the dep-array length stable across
        // HMR boundaries that previously removed it.
    }, [api, viewportKey, readOnly]);

    return (
        <div
            ref={setHost}
            className={cn(
                'relative h-full w-full',
                !interactive && 'pointer-events-none',
                transparent && 'excalidraw-transparent',
                hideUi && 'excalidraw-no-ui',
                className,
            )}
            data-surface={transparent ? surface : undefined}
            style={
                transparent && surface
                    ? ({ '--paper-spacing': `${surfaceSpacing}px` } as React.CSSProperties)
                    : undefined
            }
        >
            <React.Suspense fallback={null}>
                <ExcalidrawComp
                    initialData={initialData}
                    excalidrawAPI={(ref: ExcalidrawImperativeAPI) => {
                        setApi(ref);
                        onReady?.(ref);
                    }}
                    onChange={handleChange}
                    // `viewModeEnabled` completely removes Excalidraw's toolbar
                    // and tool state, which is what we want whenever the canvas
                    // is acting as a passive overlay (hideUi) or an explicit
                    // read-only viewer (readOnly). `zenModeEnabled` alone still
                    // renders a minimized toolbar, which would leak through the
                    // text editor and steal clicks.
                    viewModeEnabled={readOnly || hideUi}
                    zenModeEnabled={hideUi}
                    theme={resolvedTheme}
                    handleKeyboardGlobally={false}
                    UIOptions={
                        hideUi
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
    );
}

/**
 * Resolve the Excalidraw `theme` prop. If the caller passed an explicit
 * theme we honor it; otherwise we follow the `dark` class applied by
 * `next-themes` to <html>, which already reflects the user's choice
 * (system / light / dark). A MutationObserver keeps us in sync when the
 * user toggles it from the settings dialog.
 */
function useResolvedTheme(explicit?: 'light' | 'dark'): 'light' | 'dark' {
    const [detected, setDetected] = React.useState<'light' | 'dark'>(() => {
        if (typeof document === 'undefined') return 'light';
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    });

    React.useEffect(() => {
        if (explicit) return;
        if (typeof document === 'undefined') return;
        const html = document.documentElement;
        const read = () =>
            setDetected(html.classList.contains('dark') ? 'dark' : 'light');
        read();
        const mo = new MutationObserver(read);
        mo.observe(html, { attributes: true, attributeFilter: ['class'] });
        return () => mo.disconnect();
    }, [explicit]);

    return explicit ?? detected;
}

/* -------------------------------------------------------------------- */
/* Viewport persistence                                                 */
/* -------------------------------------------------------------------- */

interface PersistedViewport {
    scrollX: number;
    scrollY: number;
    zoom: number;
}

function readViewport(key: string | undefined): PersistedViewport | null {
    if (!key || typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedViewport>;
        if (
            typeof parsed.scrollX !== 'number' ||
            typeof parsed.scrollY !== 'number' ||
            typeof parsed.zoom !== 'number'
        ) {
            return null;
        }
        return parsed as PersistedViewport;
    } catch {
        return null;
    }
}

function writeViewport(key: string, v: PersistedViewport): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(v));
    } catch {
        /* quota or privacy mode \u2014 silently ignore */
    }
}

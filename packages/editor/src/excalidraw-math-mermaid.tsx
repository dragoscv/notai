'use client';
import * as React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Phase-2 of the Excalidraw migration: rendered math + Mermaid previews.
 *
 * Source-of-truth stays plain text — exactly like every other Phase-2
 * overlay. We scan every text element for two patterns:
 *
 *   - `$$ … $$` blocks (KaTeX display math)
 *   - ```` ```mermaid … ``` ```` blocks (Mermaid diagrams)
 *
 * For each match, we render the result as an absolutely-positioned HTML
 * preview *below* the owning text element. The source text stays editable
 * on the canvas — users see both the LaTeX/diagram source and the live
 * render, the same dual-view that Notion / Reflect / Bear ship.
 *
 * Why an overlay (as opposed to an Excalidraw image element with the
 * SVG embedded):
 *   - Image insertion mutates the scene; overlays don't. Zero risk of
 *     re-render loops or fighting with Excalidraw's history.
 *   - Round-trips through plain-text export, copy-paste, and migration
 *     for free.
 *   - KaTeX + Mermaid are heavy; lazy-loading them and rendering into
 *     a DOM node we already own is the lightest path.
 *
 * Both libraries are loaded on first sighting and cached at module
 * scope. CSS for KaTeX is also lazy-loaded once. Mermaid uses an
 * `mermaid.render(id, source)` call which returns an SVG string we
 * inline.
 */

type AnyEl = ExcalidrawElement & {
  text?: string;
  fontSize?: number;
  customData?: Record<string, unknown> | null;
};

type RenderKind = 'math' | 'mermaid';

interface RenderTarget {
  /** Stable React key. */
  key: string;
  ownerId: string;
  kind: RenderKind;
  /** Source content to feed to KaTeX / Mermaid. */
  source: string;
  /** World coordinates of the bottom-left of the owning text element. */
  worldX: number;
  worldBottom: number;
  /** Width of the owning element (for max-width capping). */
  worldWidth: number;
}

const RE_MATH = /\$\$([\s\S]+?)\$\$/g;
const RE_MERMAID = /```mermaid\s*\n([\s\S]+?)\n```/g;

function extractTargets(elements: readonly AnyEl[]): RenderTarget[] {
  const out: RenderTarget[] = [];
  for (const el of elements) {
    if (el.type !== 'text' || el.isDeleted) continue;
    const text = el.text ?? '';
    if (!text.includes('$$') && !text.includes('```mermaid')) continue;
    let i = 0;

    RE_MATH.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_MATH.exec(text))) {
      const src = m[1]!.trim();
      if (!src) continue;
      out.push({
        key: `${el.id}:math:${i}`,
        ownerId: el.id,
        kind: 'math',
        source: src,
        worldX: (el.x ?? 0) as number,
        worldBottom: ((el.y ?? 0) as number) + ((el.height ?? 0) as number),
        worldWidth: (el.width ?? 200) as number,
      });
      i += 1;
      if (i > 16) break;
    }

    RE_MERMAID.lastIndex = 0;
    while ((m = RE_MERMAID.exec(text))) {
      const src = m[1]!.trim();
      if (!src) continue;
      out.push({
        key: `${el.id}:mermaid:${i}`,
        ownerId: el.id,
        kind: 'mermaid',
        source: src,
        worldX: (el.x ?? 0) as number,
        worldBottom: ((el.y ?? 0) as number) + ((el.height ?? 0) as number),
        worldWidth: (el.width ?? 200) as number,
      });
      i += 1;
      if (i > 16) break;
    }
  }
  return out;
}

function targetsSignature(t: RenderTarget[]): string {
  return t
    .map(
      (x) =>
        `${x.ownerId}:${x.kind}:${x.source.length}:${x.source.slice(0, 32)}:${x.worldX.toFixed(1)}:${x.worldBottom.toFixed(1)}:${x.worldWidth.toFixed(1)}`,
    )
    .join(';');
}

/* ---------- Lazy library loaders ---------- */

type KatexLib = {
  renderToString: (tex: string, opts?: object) => string;
};
let katexInstance: KatexLib | null = null;
let katexLoading: Promise<KatexLib | null> | null = null;
let katexCssInjected = false;

async function ensureKatex(): Promise<KatexLib | null> {
  if (katexInstance) return katexInstance;
  if (katexLoading) return katexLoading;
  katexLoading = (async () => {
    try {
      const mod = (await import('katex')) as unknown as { default?: KatexLib } & KatexLib;
      katexInstance = (mod.default ?? mod) as KatexLib;
      if (!katexCssInjected && typeof document !== 'undefined') {
        // Lazy-import the CSS through Next/webpack so it only ships when
        // a user actually types math on a canvas.
        await import('katex/dist/katex.min.css');
        katexCssInjected = true;
      }
      return katexInstance;
    } catch {
      return null;
    } finally {
      katexLoading = null;
    }
  })();
  return katexLoading;
}

type MermaidLib = {
  initialize: (cfg: object) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};
let mermaidInstance: MermaidLib | null = null;
let mermaidLoading: Promise<MermaidLib | null> | null = null;

async function ensureMermaid(): Promise<MermaidLib | null> {
  if (mermaidInstance) return mermaidInstance;
  if (mermaidLoading) return mermaidLoading;
  mermaidLoading = (async () => {
    try {
      const mod = (await import('mermaid')) as unknown as {
        default?: MermaidLib;
      } & MermaidLib;
      mermaidInstance = (mod.default ?? mod) as MermaidLib;
      mermaidInstance.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      });
      return mermaidInstance;
    } catch {
      return null;
    } finally {
      mermaidLoading = null;
    }
  })();
  return mermaidLoading;
}

/* ---------- Single-target renderer ---------- */

interface RenderedHTML {
  html: string;
  error: string | null;
}

const renderCache = new Map<string, RenderedHTML>();

function cacheKey(t: RenderTarget): string {
  return `${t.kind}::${t.source}`;
}

async function renderTarget(t: RenderTarget): Promise<RenderedHTML> {
  const key = cacheKey(t);
  const hit = renderCache.get(key);
  if (hit) return hit;

  let result: RenderedHTML;
  try {
    if (t.kind === 'math') {
      const katex = await ensureKatex();
      if (!katex) {
        result = { html: '', error: 'KaTeX failed to load' };
      } else {
        const html = katex.renderToString(t.source, {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        });
        result = { html, error: null };
      }
    } else {
      const mermaid = await ensureMermaid();
      if (!mermaid) {
        result = { html: '', error: 'Mermaid failed to load' };
      } else {
        const id = `m-${Math.random().toString(36).slice(2, 10)}`;
        const { svg } = await mermaid.render(id, t.source);
        result = { html: svg, error: null };
      }
    }
  } catch (err) {
    result = { html: '', error: (err as Error).message };
  }

  renderCache.set(key, result);
  // Cap the cache so a noisy doc can't grow it unboundedly.
  if (renderCache.size > 512) {
    const first = renderCache.keys().next().value;
    if (first) renderCache.delete(first);
  }
  return result;
}

/* ---------- Component ---------- */

export interface ExcalidrawMathMermaidOverlayProps {
  api: ExcalidrawImperativeAPI | null;
  enabled?: boolean;
}

export function ExcalidrawMathMermaidOverlay({
  api,
  enabled = true,
}: ExcalidrawMathMermaidOverlayProps): React.ReactElement | null {
  const [targets, setTargets] = React.useState<RenderTarget[]>([]);
  const [viewport, setViewport] = React.useState({ scrollX: 0, scrollY: 0, zoom: 1 });
  const sigRef = React.useRef<string>('');
  // Per-overlay rendered map. Survives across canvas changes; cleared
  // entries are GC'd as the source signatures evolve.
  const [rendered, setRendered] = React.useState<Map<string, RenderedHTML>>(() => new Map());

  React.useEffect(() => {
    if (!api || !enabled) return;
    const compute = () => {
      const els = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
      const next = extractTargets(els);
      const sig = targetsSignature(next);
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setTargets(next);
      }
      const appState = api.getAppState() as {
        scrollX?: number;
        scrollY?: number;
        zoom?: { value?: number } | number;
      };
      const zoom = typeof appState.zoom === 'number' ? appState.zoom : (appState.zoom?.value ?? 1);
      setViewport((prev) => {
        const sx = appState.scrollX ?? 0;
        const sy = appState.scrollY ?? 0;
        if (
          Math.abs(prev.scrollX - sx) < 0.5 &&
          Math.abs(prev.scrollY - sy) < 0.5 &&
          Math.abs(prev.zoom - zoom) < 0.001
        ) {
          return prev;
        }
        return { scrollX: sx, scrollY: sy, zoom };
      });
    };
    compute();
    const unsub = api.onChange(() => compute());
    return () => unsub();
  }, [api, enabled]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Array<[string, RenderedHTML]> = [];
      for (const t of targets) {
        const key = cacheKey(t);
        if (rendered.has(key)) continue;
        const html = await renderTarget(t);
        if (cancelled) return;
        updates.push([key, html]);
      }
      if (updates.length === 0) return;
      setRendered((prev) => {
        const next = new Map(prev);
        for (const [k, v] of updates) next.set(k, v);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [targets, rendered]);

  if (!enabled || !api || targets.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-focus-hide>
      {targets.map((t) => {
        const key = cacheKey(t);
        const r = rendered.get(key);
        const left = (t.worldX + viewport.scrollX) * viewport.zoom;
        const top = (t.worldBottom + viewport.scrollY) * viewport.zoom + 6;
        const maxWidth = Math.max(160, t.worldWidth * viewport.zoom);
        return (
          <div
            key={t.key}
            className="absolute"
            style={{
              left,
              top,
              maxWidth,
              transformOrigin: '0 0',
              transform: `scale(${viewport.zoom})`,
            }}
          >
            <div
              className={
                'bg-card/95 pointer-events-auto rounded-md border px-3 py-2 shadow-sm backdrop-blur ' +
                (r?.error
                  ? 'border-destructive/50 text-destructive'
                  : 'border-border text-foreground')
              }
              style={{
                // Cap width before scaling so the inner SVG doesn't
                // overflow the canvas viewport at extreme zoom.
                maxWidth: Math.max(120, t.worldWidth),
                fontSize: 14,
              }}
            >
              {!r ? (
                <span className="text-muted-foreground text-xs">
                  Rendering {t.kind === 'math' ? 'math' : 'diagram'}…
                </span>
              ) : r.error ? (
                <span className="text-xs">
                  {t.kind} error: {r.error}
                </span>
              ) : (
                <div
                  // KaTeX/Mermaid produce sanitized output; KaTeX uses
                  // its own escaping pipeline and Mermaid runs in
                  // `securityLevel: 'strict'` (no user-supplied HTML).
                  // Sources come from the user's own canvas only.
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: r.html }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

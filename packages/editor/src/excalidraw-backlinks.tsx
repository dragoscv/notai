'use client';
import * as React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Phase-2 of the Excalidraw migration: clickable backlinks on canvas text.
 *
 * We keep the source-of-truth as plain text — users type `[[Note title]]`
 * inside any Excalidraw text element exactly as they do in TipTap blocks,
 * Obsidian, or Reflect. This overlay component scans every text element
 * for `[[…]]` patterns, resolves each title via the same `searchBacklinks`
 * callback the TipTap layer uses, and renders an absolutely-positioned
 * pill beneath each element listing its outbound links.
 *
 * Why an overlay instead of a custom Excalidraw element type:
 *   - Round-trips perfectly through migration (plaintext stays plaintext).
 *   - No fork of `@excalidraw/excalidraw`, no scene-shape churn, no scene
 *     mutations from this file at all (it's read-only over the scene).
 *   - Works on legacy notes the moment they migrate — every `[[…]]` that
 *     existed in TipTap text shows up as a chip.
 *
 * Click handling uses the existing `<a data-backlink="<id>">` convention
 * picked up by `note-workspace.tsx`'s `onClickCapture` → `router.push`,
 * so navigation is a single source of truth shared with TipTap blocks.
 */

type AnyEl = ExcalidrawElement & {
  text?: string;
  fontSize?: number;
  customData?: Record<string, unknown> | null;
};

interface BacklinkChip {
  /** Stable key for React reconciliation. */
  key: string;
  /** Resolved note id, or null when the title couldn't be matched. */
  id: string | null;
  /** Display title (taken verbatim from `[[…]]`). */
  title: string;
  /** Element this backlink belongs to (so we can position the chip). */
  ownerId: string;
}

interface ChipGroup {
  ownerId: string;
  /** Top-left of the owning element in *world* coordinates. */
  worldX: number;
  /** Bottom edge of the owning element in *world* coordinates. */
  worldBottom: number;
  /** Element width in world coordinates. Caps the chip row. */
  worldWidth: number;
  chips: BacklinkChip[];
}

const RE_BACKLINK = /\[\[([^\]\n]{1,200})\]\]/g;

function extractGroups(elements: readonly AnyEl[]): ChipGroup[] {
  const out: ChipGroup[] = [];
  for (const el of elements) {
    if (el.type !== 'text' || el.isDeleted) continue;
    const text = el.text ?? '';
    if (!text.includes('[[')) continue;
    const chips: BacklinkChip[] = [];
    let i = 0;
    RE_BACKLINK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_BACKLINK.exec(text))) {
      const title = m[1]!.trim();
      if (!title) continue;
      chips.push({
        key: `${el.id}:${i}:${title}`,
        id: null,
        title,
        ownerId: el.id,
      });
      i += 1;
      if (i > 32) break; // Safety: don't render hundreds of chips per element.
    }
    if (chips.length === 0) continue;
    out.push({
      ownerId: el.id,
      worldX: (el.x ?? 0) as number,
      worldBottom: ((el.y ?? 0) as number) + ((el.height ?? 0) as number),
      worldWidth: (el.width ?? 200) as number,
      chips,
    });
  }
  return out;
}

function groupSignature(groups: ChipGroup[]): string {
  // Cheap signature so we only re-render when something actually changed.
  return groups
    .map(
      (g) =>
        `${g.ownerId}:${g.worldX.toFixed(1)}:${g.worldBottom.toFixed(1)}:${g.worldWidth.toFixed(1)}:${g.chips.map((c) => c.title).join('|')}`,
    )
    .join(';');
}

export interface ExcalidrawBacklinksOverlayProps {
  api: ExcalidrawImperativeAPI | null;
  enabled?: boolean;
  searchBacklinks?: (q: string) => Promise<Array<{ id: string; title: string }>>;
}

export function ExcalidrawBacklinksOverlay({
  api,
  enabled = true,
  searchBacklinks,
}: ExcalidrawBacklinksOverlayProps): React.ReactElement | null {
  const [groups, setGroups] = React.useState<ChipGroup[]>([]);
  const [viewport, setViewport] = React.useState({ scrollX: 0, scrollY: 0, zoom: 1 });
  const sigRef = React.useRef<string>('');
  // Title → noteId cache. Survives across renders, scoped per overlay
  // instance (which is one-per-canvas), so a 50-link note doesn't fire 50
  // resolutions every onChange tick.
  const resolvedRef = React.useRef<Map<string, string | null>>(new Map());
  const inflightRef = React.useRef<Map<string, Promise<string | null>>>(new Map());

  // Subscribe to scene + viewport changes.
  React.useEffect(() => {
    if (!api || !enabled) return;
    const compute = () => {
      const els = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
      const next = extractGroups(els);
      const sig = groupSignature(next);
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setGroups(next);
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

  // Resolve titles → ids lazily. Re-runs whenever a new title appears.
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!searchBacklinks) return;
    let cancelled = false;
    const titles = new Set<string>();
    for (const g of groups) for (const c of g.chips) titles.add(c.title);
    for (const title of titles) {
      const cache = resolvedRef.current;
      if (cache.has(title)) continue;
      if (inflightRef.current.has(title)) continue;
      const p = (async () => {
        try {
          const rows = await searchBacklinks(title);
          const exact =
            rows.find((r) => r.title.trim().toLowerCase() === title.toLowerCase()) ?? rows[0];
          return exact?.id ?? null;
        } catch {
          return null;
        }
      })();
      inflightRef.current.set(title, p);
      void p.then((id) => {
        if (cancelled) return;
        resolvedRef.current.set(title, id);
        inflightRef.current.delete(title);
        forceRender();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [groups, searchBacklinks]);

  if (!enabled || !api || groups.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-focus-hide>
      {groups.map((g) => {
        // World → screen: screenPx = (world + scroll) * zoom.
        const left = (g.worldX + viewport.scrollX) * viewport.zoom;
        const top = (g.worldBottom + viewport.scrollY) * viewport.zoom + 4;
        const maxWidth = Math.max(120, g.worldWidth * viewport.zoom);
        return (
          <div
            key={g.ownerId}
            className="absolute flex flex-wrap gap-1"
            style={{ left, top, maxWidth }}
          >
            {g.chips.map((c) => {
              const id = resolvedRef.current.get(c.title) ?? null;
              const resolved = id !== null;
              return (
                <a
                  key={c.key}
                  href={resolved ? `/app/n/${id}` : '#'}
                  data-backlink={resolved ? id : undefined}
                  data-backlink-title={c.title}
                  title={resolved ? `Open "${c.title}"` : `No note matches "${c.title}" yet`}
                  className={
                    'pointer-events-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-colors ' +
                    (resolved
                      ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                      : 'border-border bg-muted/70 text-muted-foreground hover:bg-muted')
                  }
                  onMouseDown={(e) => {
                    // Avoid stealing Excalidraw's drag-start on the
                    // owning element when the user just wants to click
                    // the chip.
                    e.stopPropagation();
                  }}
                >
                  <span aria-hidden>{resolved ? '↗' : '?'}</span>
                  <span className="truncate" style={{ maxWidth: 180 }}>
                    {c.title}
                  </span>
                </a>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

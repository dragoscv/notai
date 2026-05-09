'use client';
import * as React from 'react';
import * as Y from 'yjs';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { cn } from '@notai/lib/utils';
import { peekBlocksArray, type SceneBlock } from './migrate-doc';

export type MinimapCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface MinimapSettings {
  enabled: boolean;
  corner: MinimapCorner;
}

export const MINIMAP_DEFAULT: MinimapSettings = { enabled: true, corner: 'br' };

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MinimapShape {
  /** World-space bbox. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'block' | 'element';
}

interface MinimapProps {
  doc: Y.Doc;
  /** Live host element (the canvas-note wrapper) used for viewport size. */
  host: HTMLElement | null;
  /** Imperative Excalidraw API for reading viewport + scrolling. */
  api: ExcalidrawImperativeAPI | null;
  /** Current viewport (controlled by CanvasNote). */
  viewport: { zoom: number; scrollX: number; scrollY: number };
  corner: MinimapCorner;
  onCornerChange: (c: MinimapCorner) => void;
}

const SIZE = 180; // px
const MARGIN = 12;
const PADDING = 24; // world-px padding around content for breathing room

const EXCALIDRAW_MAP = 'excalidraw';
const ELEMENTS_FIELD = 'elements';

interface ExcalidrawElementLike {
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  type?: string;
}

function readElements(doc: Y.Doc): ExcalidrawElementLike[] {
  const raw = doc.getMap(EXCALIDRAW_MAP).get(ELEMENTS_FIELD);
  if (!Array.isArray(raw)) return [];
  return (raw as ExcalidrawElementLike[]).filter(
    (e) => e && !e.isDeleted && Number.isFinite(e.x) && Number.isFinite(e.y),
  );
}

function readBlocks(doc: Y.Doc): SceneBlock[] {
  const arr = peekBlocksArray(doc);
  return arr ? arr.toArray() : [];
}

/**
 * Subscribe to both excalidraw elements and the blocks array to recompute
 * shapes whenever either changes.
 */
function useMinimapShapes(doc: Y.Doc): { shapes: MinimapShape[]; bbox: BBox | null } {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const yMap = doc.getMap(EXCALIDRAW_MAP);
      const scene = doc.getMap('scene');
      let blocksArr: Y.Array<SceneBlock> | null = null;

      const attachBlocks = (next: Y.Array<SceneBlock> | null) => {
        if (blocksArr === next) return;
        if (blocksArr) blocksArr.unobserve(cb);
        blocksArr = next;
        if (next) next.observe(cb);
      };
      attachBlocks(peekBlocksArray(doc));

      const onScene = (ev: Y.YMapEvent<unknown>) => {
        if (!ev.keysChanged.has('blocks')) return;
        attachBlocks(peekBlocksArray(doc));
        cb();
      };
      const onElements = () => cb();

      yMap.observe(onElements);
      scene.observe(onScene);

      return () => {
        yMap.unobserve(onElements);
        scene.unobserve(onScene);
        if (blocksArr) blocksArr.unobserve(cb);
      };
    },
    [doc],
  );

  const get = React.useCallback((): { shapes: MinimapShape[]; bbox: BBox | null } => {
    const elements = readElements(doc);
    const blocks = readBlocks(doc);
    const shapes: MinimapShape[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const e of elements) {
      const w = Math.max(1, e.width || 1);
      const h = Math.max(1, e.height || 1);
      shapes.push({ kind: 'element', x: e.x, y: e.y, w, h });
      if (e.x < minX) minX = e.x;
      if (e.y < minY) minY = e.y;
      if (e.x + w > maxX) maxX = e.x + w;
      if (e.y + h > maxY) maxY = e.y + h;
    }
    for (const b of blocks) {
      // Block height auto-fits content; we don't know it from Y. Use a
      // generous estimate so the block at least appears on the minimap.
      const h = 80;
      shapes.push({ kind: 'block', x: b.x, y: b.y, w: b.width, h });
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + h > maxY) maxY = b.y + h;
    }

    if (!Number.isFinite(minX)) return { shapes: [], bbox: null };
    return {
      shapes,
      bbox: {
        x: minX - PADDING,
        y: minY - PADDING,
        w: maxX - minX + PADDING * 2,
        h: maxY - minY + PADDING * 2,
      },
    };
  }, [doc]);

  // shapes/bbox identity changes on every call; that's OK because the
  // outer component memoizes consumers via key positions.
  return React.useSyncExternalStore(subscribe, get, get);
}

interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** World-space viewport rect derived from screen size + zoom + scroll. */
function computeViewportRect(
  host: HTMLElement | null,
  viewport: { zoom: number; scrollX: number; scrollY: number },
): ViewportRect | null {
  if (!host) return null;
  const rect = host.getBoundingClientRect();
  const z = Math.max(0.0001, viewport.zoom);
  return {
    x: -viewport.scrollX,
    y: -viewport.scrollY,
    w: rect.width / z,
    h: rect.height / z,
  };
}

/** Pick the corner whose center is closest to (x, y) inside a host of {w, h}. */
function nearestCorner(
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  margin: number,
): MinimapCorner {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const targets: { corner: MinimapCorner; cx: number; cy: number }[] = [
    { corner: 'tl', cx: margin + size / 2, cy: margin + size / 2 },
    { corner: 'tr', cx: w - margin - size / 2, cy: margin + size / 2 },
    { corner: 'bl', cx: margin + size / 2, cy: h - margin - size / 2 },
    { corner: 'br', cx: w - margin - size / 2, cy: h - margin - size / 2 },
  ];
  let best = targets[0]!;
  let bestDist = Infinity;
  for (const t of targets) {
    const dx = t.cx - cx;
    const dy = t.cy - cy;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best.corner;
}

export function Minimap({ doc, host, api, viewport, corner, onCornerChange }: MinimapProps) {
  const { shapes, bbox } = useMinimapShapes(doc);
  const viewportRect = computeViewportRect(host, viewport);

  // Drag-to-snap state. While dragging we render at `dragPos` rather
  // than the snapped corner; on release we commit the nearest corner.
  const [dragPos, setDragPos] = React.useState<{ x: number; y: number } | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  const positionStyle = React.useMemo<React.CSSProperties>(() => {
    if (dragPos) {
      return { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' };
    }
    switch (corner) {
      case 'tl':
        return { left: MARGIN, top: MARGIN };
      case 'tr':
        return { right: MARGIN, top: MARGIN };
      case 'bl':
        return { left: MARGIN, bottom: MARGIN };
      case 'br':
      default:
        return { right: MARGIN, bottom: MARGIN };
    }
  }, [corner, dragPos]);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!host) return;
    const wrapperRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - wrapperRect.left,
      offsetY: e.clientY - wrapperRect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !host) return;
    if (drag.pointerId !== e.pointerId) return;
    const hostRect = host.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(hostRect.width - SIZE, e.clientX - hostRect.left - drag.offsetX),
    );
    const y = Math.max(
      0,
      Math.min(hostRect.height - SIZE, e.clientY - hostRect.top - drag.offsetY),
    );
    drag.moved = true;
    setDragPos({ x, y });
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (drag.moved && dragPos && host) {
      const hostRect = host.getBoundingClientRect();
      onCornerChange(
        nearestCorner(dragPos.x, dragPos.y, hostRect.width, hostRect.height, SIZE, MARGIN),
      );
    }
    dragRef.current = null;
    setDragPos(null);
  };

  const onMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!api || !bbox || !host) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const scale = Math.min(SIZE / bbox.w, SIZE / bbox.h);
    const offX = (SIZE - bbox.w * scale) / 2;
    const offY = (SIZE - bbox.h * scale) / 2;
    // Click point in WORLD space
    const worldX = bbox.x + (px - offX) / scale;
    const worldY = bbox.y + (py - offY) / scale;
    // Centre that world point in the host viewport
    const hostRect = host.getBoundingClientRect();
    const z = Math.max(0.0001, viewport.zoom);
    const targetScrollX = hostRect.width / 2 / z - worldX;
    const targetScrollY = hostRect.height / 2 / z - worldY;
    api.updateScene({
      appState: {
        scrollX: targetScrollX,
        scrollY: targetScrollY,
      } as never,
    });
  };

  if (!bbox) {
    // Nothing to show yet — keep a placeholder so the toggle/drag UI is
    // still discoverable on a new note.
  }

  const scale = bbox ? Math.min(SIZE / bbox.w, SIZE / bbox.h) : 1;
  const offX = bbox ? (SIZE - bbox.w * scale) / 2 : 0;
  const offY = bbox ? (SIZE - bbox.h * scale) / 2 : 0;

  return (
    <div
      className={cn(
        'border-border/60 bg-background/85 absolute z-20 rounded-md border shadow-lg backdrop-blur',
        'transition-shadow',
        dragPos && 'shadow-2xl',
      )}
      style={{ width: SIZE, height: SIZE + 18, ...positionStyle, touchAction: 'none' }}
      data-minimap-corner={corner}
    >
      <div
        role="button"
        tabIndex={0}
        title="Drag to reposition"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        className={cn(
          'text-muted-foreground bg-muted/60 hover:bg-muted flex h-[18px] cursor-grab select-none items-center justify-center rounded-t-md text-[10px] font-medium tracking-wide',
          dragRef.current && 'cursor-grabbing',
        )}
      >
        Map
      </div>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onClick={onMapClick}
        className="block cursor-pointer"
        aria-label="Note minimap"
      >
        <rect width={SIZE} height={SIZE} fill="transparent" />
        {bbox &&
          shapes.map((s, i) => (
            <rect
              key={i}
              x={offX + (s.x - bbox.x) * scale}
              y={offY + (s.y - bbox.y) * scale}
              width={Math.max(1, s.w * scale)}
              height={Math.max(1, s.h * scale)}
              className={s.kind === 'block' ? 'fill-foreground/40' : 'fill-foreground/70'}
            />
          ))}
        {bbox && viewportRect && (
          <rect
            x={offX + (viewportRect.x - bbox.x) * scale}
            y={offY + (viewportRect.y - bbox.y) * scale}
            width={Math.max(2, viewportRect.w * scale)}
            height={Math.max(2, viewportRect.h * scale)}
            className="fill-primary/10 stroke-primary"
            strokeWidth={1.25}
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

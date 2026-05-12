'use client';
import * as React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Range-calc overlay: when the user selects two or more text elements
 * on the canvas, parse every number out of their text content and show
 * a floating chip-bar with sum / mean / min / max / count. Clicking a
 * stat inserts a new text element below the selection's bounding box
 * with the result, e.g. "Sum: 1,234".
 *
 * This is the multi-element complement to `useExcalidrawCalc`, which
 * handles in-place per-line `expr =` evaluation. Together they give the
 * canvas Apple-Math-Notes-grade feel without ever leaving plain text.
 */

type AnyEl = ExcalidrawElement & {
  text?: string;
  fontSize?: number;
  customData?: Record<string, unknown> | null;
};

const NUMBER_RE = /-?\d{1,3}(?:[ ,_]\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

interface Selected {
  ids: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function useSelectedTextElements(api: ExcalidrawImperativeAPI | null): Selected | null {
  const [sel, setSel] = React.useState<Selected | null>(null);

  React.useEffect(() => {
    if (!api) return;
    const compute = () => {
      const appState = api.getAppState() as {
        selectedElementIds?: Record<string, boolean>;
      };
      const selectedIds = Object.entries(appState.selectedElementIds ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (selectedIds.length < 2) {
        setSel((prev) => (prev === null ? prev : null));
        return;
      }
      const els = api.getSceneElements() as readonly AnyEl[];
      const targets = els.filter(
        (e) => selectedIds.includes(e.id) && e.type === 'text' && !e.isDeleted,
      );
      if (targets.length < 2) {
        setSel((prev) => (prev === null ? prev : null));
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const t of targets) {
        const w = (t as { width?: number }).width ?? 0;
        const h = (t as { height?: number }).height ?? 0;
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + w);
        maxY = Math.max(maxY, t.y + h);
      }
      const ids = targets.map((t) => t.id);
      setSel((prev) => {
        if (
          prev &&
          prev.ids.length === ids.length &&
          prev.ids.every((id, i) => ids[i] === id) &&
          prev.bounds.minX === minX &&
          prev.bounds.maxX === maxX
        ) {
          return prev;
        }
        return { ids, bounds: { minX, minY, maxX, maxY } };
      });
    };
    compute();
    const unsub = api.onChange(() => compute());
    return () => unsub();
  }, [api]);

  return sel;
}

function parseNumbers(api: ExcalidrawImperativeAPI, ids: string[]): number[] {
  const els = api.getSceneElements() as readonly AnyEl[];
  const out: number[] = [];
  for (const el of els) {
    if (!ids.includes(el.id)) continue;
    const text = (el.text ?? '') as string;
    if (!text) continue;
    const matches = text.match(NUMBER_RE);
    if (!matches) continue;
    for (const m of matches) {
      // Strip common thousands separators (` `, `,`, `_`) before parseFloat.
      const cleaned = m.replace(/[ ,_]/g, '');
      const n = Number.parseFloat(cleaned);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  return out;
}

interface Stats {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
}

function statsFor(nums: number[]): Stats | null {
  if (nums.length === 0) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const n of nums) {
    sum += n;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return { count: nums.length, sum, mean: sum / nums.length, min, max };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  // Round to 6 fractional digits, drop trailing zeros, group thousands.
  const rounded = Math.round(n * 1e6) / 1e6;
  const fixed = Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const [intPart, fracPart] = fixed.split('.');
  const grouped = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${grouped}.${fracPart}` : grouped;
}

function makeResultElement(
  label: string,
  value: string,
  x: number,
  y: number,
  kind: 'sum' | 'mean' | 'min' | 'max',
): ExcalidrawElement {
  const text = `${label}: ${value}`;
  const fontSize = 16;
  const lineHeight = 1.35;
  const width = Math.max(160, Math.ceil(text.length * fontSize * 0.6) + 24);
  const height = Math.max(fontSize * lineHeight, fontSize * lineHeight) + 8;
  const seed = Math.floor(Math.random() * 0x7fffffff);
  return {
    id: `rangecalc-${Date.now().toString(36)}-${seed.toString(36)}`,
    type: 'text',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#0f172a',
    backgroundColor: '#fef3c7',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: fontSize,
    containerId: null,
    originalText: text,
    lineHeight,
    locked: false,
    seed,
    version: 1,
    versionNonce: Math.floor(Math.random() * 0x7fffffff),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    customData: { calcRangeResult: true, calcRangeKind: kind },
    autoResize: true,
  } as unknown as ExcalidrawElement;
}

export interface ExcalidrawRangeCalcLabels {
  /** Header word before the chip group, e.g. "Selection:". */
  selection: string;
  /** Label inserted as the prefix of the text element on the canvas
   *  for the sum, e.g. "Sum" → "Sum: 1,234". */
  sum: string;
  sumHint: string;
  mean: string;
  meanHint: string;
  min: string;
  minHint: string;
  max: string;
  maxHint: string;
}

const DEFAULT_RANGE_CALC_LABELS: ExcalidrawRangeCalcLabels = {
  selection: 'Selection:',
  sum: 'Sum',
  sumHint: 'Insert sum below',
  mean: 'Mean',
  meanHint: 'Insert mean below',
  min: 'Min',
  minHint: 'Insert min below',
  max: 'Max',
  maxHint: 'Insert max below',
};

interface ExcalidrawRangeCalcOverlayProps {
  api: ExcalidrawImperativeAPI | null;
  enabled: boolean;
  labels?: ExcalidrawRangeCalcLabels;
}

export function ExcalidrawRangeCalcOverlay({
  api,
  enabled,
  labels = DEFAULT_RANGE_CALC_LABELS,
}: ExcalidrawRangeCalcOverlayProps) {
  const sel = useSelectedTextElements(enabled ? api : null);
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  // Re-render the chip-bar on viewport changes (zoom, scroll) so positions stay correct.
  React.useEffect(() => {
    if (!api || !sel) return;
    const unsub = api.onChange(() => force());
    return () => unsub();
  }, [api, sel]);

  if (!api || !sel) return null;
  const numbers = parseNumbers(api, sel.ids);
  const stats = statsFor(numbers);
  if (!stats) return null;

  const state = api.getAppState() as {
    scrollX: number;
    scrollY: number;
    zoom: { value: number };
  };
  const screenX = (sel.bounds.minX + state.scrollX) * state.zoom.value;
  const screenY = (sel.bounds.maxY + state.scrollY) * state.zoom.value;

  const insert = (label: string, value: number, kind: 'sum' | 'mean' | 'min' | 'max') => {
    const padX = 0;
    const padY = 16;
    const target = sel.bounds.minX + padX;
    const targetY = sel.bounds.maxY + padY;
    const existing = api.getSceneElements();
    const fresh = makeResultElement(label, fmt(value), target, targetY, kind);
    api.updateScene({
      elements: [...existing, fresh],
      appState: { selectedElementIds: { [fresh.id]: true } },
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY + 6,
        zIndex: 5,
        pointerEvents: 'auto',
      }}
      className="bg-popover/95 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] shadow-md backdrop-blur"
    >
      <span className="text-muted-foreground">{labels.selection}</span>
      <button
        type="button"
        onClick={() => insert(labels.sum, stats.sum, 'sum')}
        className="hover:bg-accent rounded px-1.5 py-0.5 font-mono"
        title={labels.sumHint}
      >
        Σ {fmt(stats.sum)}
      </button>
      <button
        type="button"
        onClick={() => insert(labels.mean, stats.mean, 'mean')}
        className="hover:bg-accent rounded px-1.5 py-0.5 font-mono"
        title={labels.meanHint}
      >
        μ {fmt(stats.mean)}
      </button>
      <button
        type="button"
        onClick={() => insert(labels.min, stats.min, 'min')}
        className="hover:bg-accent rounded px-1.5 py-0.5 font-mono"
        title={labels.minHint}
      >
        ↓ {fmt(stats.min)}
      </button>
      <button
        type="button"
        onClick={() => insert(labels.max, stats.max, 'max')}
        className="hover:bg-accent rounded px-1.5 py-0.5 font-mono"
        title={labels.maxHint}
      >
        ↑ {fmt(stats.max)}
      </button>
      <span className="text-muted-foreground border-l pl-2">n={stats.count}</span>
    </div>
  );
}

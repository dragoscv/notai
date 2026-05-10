'use client';
import * as React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Excalidraw-native Calc — Apple Math Notes for the canvas.
 *
 * Watches every text element on the Excalidraw scene. For each line that
 * looks like `expr = ` (trailing equals) or `name = expr` (assignment),
 * computes the result via mathjs and renders it as a sibling, non-editable
 * text element placed to the right of the source.
 *
 * Variables defined earlier in the same text element are visible to later
 * lines (`apples = 12`, then `apples * 2 = ` → 24). Each text element has
 * its own scope to keep behaviour predictable.
 *
 * Result elements are marked with `customData.calcResultOf = <sourceId>`
 * so we can find, update, or remove them on subsequent scene changes
 * without ever touching user content.
 */

type AnyEl = ExcalidrawElement & {
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  lineHeight?: number;
  customData?: Record<string, unknown> | null;
};

type MathInstance = {
  evaluate: (expr: string, scope?: Record<string, unknown>) => unknown;
  format: (x: unknown, opts?: object) => string;
};

let mathInstance: MathInstance | null = null;
let mathLoading = false;
const mathReadyHooks: Array<() => void> = [];

function ensureMath(onReady?: () => void): MathInstance | null {
  if (mathInstance) return mathInstance;
  if (onReady) mathReadyHooks.push(onReady);
  if (mathLoading) return null;
  mathLoading = true;
  void import('mathjs')
    .then((mod) => {
      const m = mod as unknown as { create: (cfg: object) => MathInstance; all: object };
      mathInstance = m.create(m.all);
      mathLoading = false;
      while (mathReadyHooks.length) mathReadyHooks.shift()?.();
    })
    .catch(() => {
      mathLoading = false;
    });
  return null;
}

const RE_ASSIGN = /^([a-zA-Z_][\w]*)\s*=\s*(.+?)\s*$/;
const RE_QUERY = /^(.+?)\s*=\s*$/;

function formatValue(math: MathInstance, value: unknown): string {
  try {
    if (typeof value === 'number') {
      const rounded = Math.round(value * 1e10) / 1e10;
      return Number.isFinite(rounded) ? String(rounded) : String(value);
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return math.format(value, { precision: 10 });
  } catch {
    return String(value);
  }
}

interface ResultLine {
  /** 0-based line index in the source text element. */
  lineIndex: number;
  /** Rendered display, e.g. "60", "5 m/s". */
  display: string;
  /** True for assignment lines; rendered slightly dimmer. */
  assignment: boolean;
}

function computeResults(
  text: string,
  math: MathInstance,
  /**
   * Optional cross-element scope. Names defined in *other* text
   * elements (e.g. `tax = 0.19` written above) are pre-seeded here so
   * a query line `price * (1 + tax) =` in this element can resolve
   * them. Local assignments inside this text element shadow the
   * shared scope without mutating it.
   */
  sharedScope?: Readonly<Record<string, unknown>>,
): ResultLine[] {
  const lines = text.split('\n');
  const scope: Record<string, unknown> = sharedScope ? { ...sharedScope } : {};
  const out: ResultLine[] = [];

  lines.forEach((line, idx) => {
    if (!line.includes('=')) {
      out.push({ lineIndex: idx, display: '', assignment: false });
      return;
    }
    const a = RE_ASSIGN.exec(line);
    if (a && a[2] && a[2].trim().length > 0) {
      const name = a[1]!;
      const rhs = a[2]!;
      try {
        const value = math.evaluate(rhs, scope);
        if (typeof value === 'function' || value === undefined) {
          out.push({ lineIndex: idx, display: '', assignment: false });
          return;
        }
        scope[name] = value;
        const formatted = formatValue(math, value);
        if (rhs.trim() === formatted.trim()) {
          out.push({ lineIndex: idx, display: '', assignment: false });
          return;
        }
        out.push({ lineIndex: idx, display: `→ ${formatted}`, assignment: true });
      } catch {
        out.push({ lineIndex: idx, display: '', assignment: false });
      }
      return;
    }
    const q = RE_QUERY.exec(line);
    if (q && q[1] && q[1].trim().length > 0) {
      const lhs = q[1]!;
      try {
        const value = math.evaluate(lhs, scope);
        if (typeof value === 'function' || value === undefined) {
          out.push({ lineIndex: idx, display: '', assignment: false });
          return;
        }
        const formatted = formatValue(math, value);
        out.push({ lineIndex: idx, display: formatted, assignment: false });
        return;
      } catch {
        out.push({ lineIndex: idx, display: '', assignment: false });
      }
      return;
    }
    out.push({ lineIndex: idx, display: '', assignment: false });
  });

  return out;
}

interface DesiredResult {
  /** Text content to render in the result element. */
  text: string;
  /** Source element id this result mirrors. */
  sourceId: string;
  /** Inherit these from source so result aligns with the same baseline. */
  fontSize: number;
  fontFamily: number;
  /** Top-left position for the result element. */
  x: number;
  y: number;
  /** Width/height the result needs (estimate). */
  width: number;
  height: number;
  /** Stable id for the result element so updates don't churn. */
  resultId: string;
}

function isCalcResult(el: AnyEl): boolean {
  return !!el.customData && (el.customData as Record<string, unknown>).calcResultOf != null;
}

/**
 * Pre-pass over every non-result text element to collect cross-element
 * variable definitions. Two iterations so a name defined later in the
 * scene order can still be referenced earlier (canvas position is
 * spatial, not linear — users don't think in "above-only").
 *
 * Variables defined here are available to every element's
 * `computeResults` call. Local assignments inside one element still
 * win locally but do not pollute the shared scope after this pass —
 * the second iteration of the pre-pass is what propagates them.
 */
function collectSharedScope(
  elements: readonly AnyEl[],
  math: MathInstance,
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (let pass = 0; pass < 2; pass++) {
    for (const el of elements) {
      if (el.type !== 'text') continue;
      if (isCalcResult(el)) continue;
      const text = el.text ?? '';
      if (!text || !text.includes('=')) continue;
      for (const line of text.split('\n')) {
        const a = RE_ASSIGN.exec(line);
        if (!a) continue;
        const rhs = a[2];
        if (!rhs || rhs.trim().length === 0) continue;
        const name = a[1]!;
        try {
          const value = math.evaluate(rhs, { ...scope });
          if (typeof value === 'function' || value === undefined) continue;
          scope[name] = value;
        } catch {
          /* unresolved on this pass — second iteration may fix it */
        }
      }
    }
  }
  return scope;
}

function buildDesired(elements: readonly AnyEl[], math: MathInstance): DesiredResult[] {
  const sharedScope = collectSharedScope(elements, math);
  const out: DesiredResult[] = [];
  for (const el of elements) {
    if (el.type !== 'text') continue;
    if (isCalcResult(el)) continue;
    const text = el.text ?? '';
    if (!text || !text.includes('=')) continue;
    const results = computeResults(text, math, sharedScope);
    const display = results.map((r) => r.display).join('\n');
    if (!display.trim()) continue;

    const fontSize = el.fontSize ?? 20;
    const fontFamily = el.fontFamily ?? 1;
    const x = el.x + (el.width ?? 0) + Math.max(12, fontSize * 0.4);
    const y = el.y;
    const lineHeightPx = fontSize * 1.25;
    // Rough width estimate — Excalidraw will recalculate on restore but we
    // need a non-zero number. Longest result line in chars × ~0.6em.
    const longest = Math.max(...display.split('\n').map((l) => l.length), 1);
    const width = Math.max(48, Math.min(640, Math.ceil(longest * fontSize * 0.6)));
    const height = Math.max(lineHeightPx, results.length * lineHeightPx);

    out.push({
      text: display,
      sourceId: el.id,
      fontSize,
      fontFamily,
      x,
      y,
      width,
      height,
      resultId: `calc-${el.id}`,
    });
  }
  return out;
}

interface DiffOutcome {
  /** True if scene needs an updateScene call. */
  changed: boolean;
  /** New element list to push. */
  next: AnyEl[];
}

function diffAndApply(elements: readonly AnyEl[], desired: DesiredResult[]): DiffOutcome {
  const desiredById = new Map<string, DesiredResult>();
  for (const d of desired) desiredById.set(d.resultId, d);

  const sourceIds = new Set(
    elements.filter((e) => e.type === 'text' && !isCalcResult(e)).map((e) => e.id),
  );

  let changed = false;
  const kept: AnyEl[] = [];

  for (const el of elements) {
    if (!isCalcResult(el)) {
      kept.push(el);
      continue;
    }
    const sourceId = (el.customData as { calcResultOf?: string } | null)?.calcResultOf;
    if (!sourceId || !sourceIds.has(sourceId)) {
      // Orphaned result (source deleted) — drop it.
      changed = true;
      continue;
    }
    const want = desiredById.get(el.id);
    if (!want) {
      // Source no longer produces a result — drop it.
      changed = true;
      continue;
    }
    desiredById.delete(el.id);
    // Update if any rendered field differs.
    const sameText = (el.text ?? '') === want.text;
    const sameX = Math.abs((el.x ?? 0) - want.x) < 0.5;
    const sameY = Math.abs((el.y ?? 0) - want.y) < 0.5;
    if (sameText && sameX && sameY) {
      kept.push(el);
    } else {
      changed = true;
      kept.push({
        ...el,
        text: want.text,
        x: want.x,
        y: want.y,
        width: want.width,
        height: want.height,
        // bump version + nonce so Excalidraw treats it as a real change.
        version: ((el as { version?: number }).version ?? 1) + 1,
        versionNonce: Math.floor(Math.random() * 0x7fffffff),
      } as AnyEl);
    }
  }

  // Remaining entries in desiredById are new results to insert.
  for (const want of desiredById.values()) {
    changed = true;
    kept.push(makeResultElement(want));
  }

  return { changed, next: kept };
}

function makeResultElement(d: DesiredResult): AnyEl {
  const lines = d.text.split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  // Excalidraw fills required fields itself when restoreElements runs —
  // here we provide enough that the scene renders before the next restore.
  return {
    id: d.resultId,
    type: 'text',
    x: d.x,
    y: d.y,
    width: d.width,
    height: d.height,
    angle: 0,
    strokeColor: '#0c8599',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    text: d.text,
    fontSize: d.fontSize,
    fontFamily: d.fontFamily,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: d.fontSize,
    containerId: null,
    originalText: d.text,
    lineHeight: 1.25,
    locked: true,
    seed: Math.floor(Math.random() * 0x7fffffff),
    version: 1,
    versionNonce: Math.floor(Math.random() * 0x7fffffff),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    customData: { calcResultOf: d.sourceId },
    autoResize: true,
    // measured-only fields below are tolerated by Excalidraw's restore.
    width_safe: longest,
  } as unknown as AnyEl;
}

/**
 * Hook: wires Calc into an Excalidraw API instance. Idempotent — safe to
 * call once per CanvasNote mount. Returns nothing; the side effect is
 * scene patching via `api.updateScene`.
 */
export function useExcalidrawCalc(api: ExcalidrawImperativeAPI | null, enabled: boolean = true) {
  // Ensure mathjs is loading from the moment the hook mounts.
  React.useEffect(() => {
    if (!enabled) return;
    ensureMath();
  }, [enabled]);

  React.useEffect(() => {
    if (!api || !enabled) return;
    let pending = 0;
    let mounted = true;
    let lastSig = '';

    const run = () => {
      if (!mounted) return;
      const math = ensureMath(() => {
        // Re-run once mathjs lands.
        scheduleRun();
      });
      if (!math) return;
      const elements = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
      const liveElements = elements.filter((e) => !e.isDeleted);
      const desired = buildDesired(liveElements, math);
      const sig = signature(desired);
      if (sig === lastSig) return;
      const diff = diffAndApply(liveElements, desired);
      if (!diff.changed) {
        lastSig = sig;
        return;
      }
      lastSig = sig;
      // captureUpdate NEVER → don't pollute undo history with calc results.
      type SceneUpdateArg = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];
      api.updateScene({
        elements: diff.next as unknown as SceneUpdateArg['elements'],
      });
    };

    const scheduleRun = () => {
      if (pending) return;
      pending = window.setTimeout(() => {
        pending = 0;
        try {
          run();
        } catch {
          /* keep scene safe — ignore one-shot errors */
        }
      }, 180);
    };

    const unsub = api.onChange(() => scheduleRun());
    // Initial pass once mounted (existing notes with calc lines should
    // light up without requiring an edit).
    scheduleRun();

    return () => {
      mounted = false;
      if (pending) window.clearTimeout(pending);
      unsub();
    };
  }, [api, enabled]);
}

function signature(desired: DesiredResult[]): string {
  let h = desired.length;
  for (const d of desired) {
    h =
      ((h * 31) ^ stringHash(`${d.resultId}|${d.text}|${Math.round(d.x)}|${Math.round(d.y)}`)) >>>
      0;
  }
  return String(h);
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

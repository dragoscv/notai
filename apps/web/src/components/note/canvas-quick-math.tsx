'use client';

import * as React from 'react';
import type { CanvasNoteHandle } from '@notai/editor';

interface SceneElement {
  id: string;
  type: string;
  text?: string;
  isDeleted?: boolean;
  version?: number;
  customData?: Record<string, unknown> | null;
  updated?: number;
}

interface ExApi {
  getSceneElements(): readonly SceneElement[];
  getSceneElementsIncludingDeleted(): readonly SceneElement[];
  onChange(cb: () => void): () => void;
  updateScene(input: { elements: readonly SceneElement[] }): void;
}

/**
 * Safe arithmetic-only expression evaluator. Supports:
 *   + - * / % ** ( )
 *   numbers (int / float / scientific)
 *   constants `pi`, `e`
 *   functions `sin cos tan asin acos atan log ln sqrt abs round floor ceil`
 *
 * Returns `null` for anything outside that grammar so we never trip
 * on a half-typed expression and never run user input through `eval`.
 */
function evaluateMath(src: string): number | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (!/^[\sA-Za-z0-9_+\-*/().,%^]+$/.test(trimmed)) return null;

  // Replace constants with values, then ^ with **.
  const replaced = trimmed
    .replace(/\bpi\b/gi, '(Math.PI)')
    .replace(/\be\b/gi, '(Math.E)')
    .replace(/\^/g, '**');

  // Whitelist function names \u2014 anything else is rejected so the
  // evaluator can\u2019t reach for window/globals.
  const allowedFns = [
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'log',
    'ln',
    'sqrt',
    'abs',
    'round',
    'floor',
    'ceil',
  ];
  const idents = replaced.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const id of idents) {
    if (allowedFns.includes(id)) continue;
    if (id === 'Math' || id === 'PI' || id === 'E') continue;
    return null;
  }

  let prepared = replaced;
  for (const fn of allowedFns) {
    const target = fn === 'ln' ? 'Math.log' : `Math.${fn}`;
    prepared = prepared.replace(new RegExp(`\\b${fn}\\(`, 'g'), `${target}(`);
  }

  try {
    const value = new Function(`"use strict"; return (${prepared});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function format(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Strip trailing zeros, cap at 10 significant digits.
  return Number.parseFloat(n.toPrecision(10)).toString();
}

/**
 * Hooks Excalidraw's `onChange` and rewrites text elements whose text
 * ends in `=` into `<expression> = <result>`. Requires no toolbar UI \u2014
 * the user just types `2+2=` and gets `2 + 2 = 4` back.
 *
 * To avoid an infinite loop we tag elements we\u2019ve already evaluated
 * with `customData.qmEval = <hash>` and only re-evaluate when that
 * hash changes.
 */
export function CanvasQuickMath({
  canvasRef,
}: {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}) {
  const inflightRef = React.useRef(false);
  React.useEffect(() => {
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) return;
    const off = api.onChange(() => {
      if (inflightRef.current) return;
      const all = api.getSceneElementsIncludingDeleted();
      let dirty = false;
      const nextEls: SceneElement[] = [];
      for (const el of all) {
        if (el.isDeleted || el.type !== 'text') {
          nextEls.push(el);
          continue;
        }
        const text = el.text ?? '';
        const m = text.match(/^([^=\n][^=\n]*)=\s*$/);
        const last = (el.customData as { qmEval?: string } | null)?.qmEval;
        if (!m) {
          nextEls.push(el);
          continue;
        }
        const expr = m[1]!.trim();
        if (last === expr) {
          nextEls.push(el);
          continue;
        }
        const value = evaluateMath(expr);
        if (value === null) {
          nextEls.push(el);
          continue;
        }
        dirty = true;
        const newText = `${expr} = ${format(value)}`;
        nextEls.push({
          ...el,
          text: newText,
          customData: { ...(el.customData ?? {}), qmEval: expr },
          version: (el.version ?? 0) + 1,
          updated: Date.now(),
        });
      }
      if (!dirty) return;
      inflightRef.current = true;
      api.updateScene({ elements: nextEls });
      // Guard against re-entry while React commits.
      setTimeout(() => {
        inflightRef.current = false;
      }, 50);
    });
    return off;
  }, [canvasRef]);
  return null;
}

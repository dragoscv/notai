'use client';
import * as React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Phase-2 of the Excalidraw migration: interactive checkboxes on canvas
 * text elements.
 *
 * Source-of-truth stays plain text. Any line starting with `[ ]`, `[x]`,
 * `- [ ]`, or `- [x]` (with optional leading whitespace) gets a
 * clickable square rendered at its left edge. Clicking toggles the
 * underlying text between unchecked and checked, in-place.
 *
 * Rationale (same as backlinks overlay): no fork of Excalidraw, no
 * custom element types, perfect round-trip through migration / export /
 * paste-as-text. Works the moment a TipTap block is migrated because
 * its checkboxes serialise to the same `[ ]`/`[x]` plaintext.
 *
 * Positioning math: Excalidraw uses `world * zoom + scroll * zoom` for
 * screen position; line height is `fontSize * lineHeight` (default 1.25
 * for text elements). Per-character horizontal offsets are intentionally
 * not used — the checkbox sits one half-em to the left of the text so
 * it works regardless of indentation or list marker width.
 */

type AnyEl = ExcalidrawElement & {
  text?: string;
  fontSize?: number;
  lineHeight?: number;
  customData?: Record<string, unknown> | null;
};

const RE_CHECKBOX = /^(\s*(?:[-*]\s+)?)\[( |x|X)\](\s*)/;

interface ChecklistMark {
  /** Stable React key. */
  key: string;
  /** Owner element id (for updateScene reconciliation). */
  ownerId: string;
  /** Line index within the element's text. */
  lineIndex: number;
  /** Top-left of the line in *world* coordinates. */
  worldX: number;
  worldY: number;
  /** Font size of the owning element (drives checkbox size). */
  fontSize: number;
  /** Currently checked? */
  checked: boolean;
}

function extractMarks(elements: readonly AnyEl[]): ChecklistMark[] {
  const out: ChecklistMark[] = [];
  for (const el of elements) {
    if (el.type !== 'text' || el.isDeleted) continue;
    const text = el.text ?? '';
    if (!text.includes('[')) continue;
    const lines = text.split('\n');
    const fontSize = (el.fontSize ?? 16) as number;
    const lineHeight = (el.lineHeight ?? 1.25) as number;
    const lineH = fontSize * lineHeight;
    for (let i = 0; i < lines.length; i++) {
      const m = RE_CHECKBOX.exec(lines[i]!);
      if (!m) continue;
      out.push({
        key: `${el.id}:${i}`,
        ownerId: el.id,
        lineIndex: i,
        worldX: (el.x ?? 0) as number,
        worldY: ((el.y ?? 0) as number) + i * lineH,
        fontSize,
        checked: m[2] === 'x' || m[2] === 'X',
      });
    }
  }
  return out;
}

function marksSignature(marks: ChecklistMark[]): string {
  return marks
    .map(
      (m) =>
        `${m.ownerId}:${m.lineIndex}:${m.checked ? 1 : 0}:${m.worldX.toFixed(1)}:${m.worldY.toFixed(1)}:${m.fontSize}`,
    )
    .join(';');
}

function toggleChecked(text: string, lineIndex: number): string | null {
  const lines = text.split('\n');
  const line = lines[lineIndex];
  if (line === undefined) return null;
  const m = RE_CHECKBOX.exec(line);
  if (!m) return null;
  const lead = m[1] ?? '';
  const trail = m[3] ?? '';
  const nextMark = m[2] === 'x' || m[2] === 'X' ? ' ' : 'x';
  const rest = line.slice(m[0].length);
  lines[lineIndex] = `${lead}[${nextMark}]${trail}${rest}`;
  return lines.join('\n');
}

function applyToggle(api: ExcalidrawImperativeAPI, ownerId: string, lineIndex: number): void {
  const elements = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
  const target = elements.find((e) => e.id === ownerId);
  if (!target || target.type !== 'text') return;
  const nextText = toggleChecked(target.text ?? '', lineIndex);
  if (nextText === null) return;

  const next = elements.map((el) => {
    if (el.id !== ownerId) return el;
    return {
      ...el,
      text: nextText,
      // Keep the other fields untouched; bump version so Excalidraw
      // re-renders without resetting text-edit state.
      version: ((el as { version?: number }).version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 0x7fffffff),
    } as AnyEl;
  });

  type SceneUpdateArg = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];
  api.updateScene({
    elements: next as unknown as SceneUpdateArg extends { elements?: infer E } ? E : never,
  } as SceneUpdateArg);
}

export interface ExcalidrawChecklistOverlayProps {
  api: ExcalidrawImperativeAPI | null;
  /** Suppress in read-only / sticky mirror contexts. */
  enabled?: boolean;
}

export function ExcalidrawChecklistOverlay({
  api,
  enabled = true,
}: ExcalidrawChecklistOverlayProps): React.ReactElement | null {
  const [marks, setMarks] = React.useState<ChecklistMark[]>([]);
  const [viewport, setViewport] = React.useState({ scrollX: 0, scrollY: 0, zoom: 1 });
  const sigRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!api || !enabled) return;
    const compute = () => {
      const els = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
      const next = extractMarks(els);
      const sig = marksSignature(next);
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setMarks(next);
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

  if (!enabled || !api || marks.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-focus-hide>
      {marks.map((m) => {
        // Position the box just to the left of the line content so it
        // sits over the `[` source character. Matches the eye well at
        // any zoom because we scale with `viewport.zoom`.
        const size = Math.max(12, m.fontSize * 0.85 * viewport.zoom);
        const left = (m.worldX + viewport.scrollX) * viewport.zoom + 1;
        const top = (m.worldY + viewport.scrollY) * viewport.zoom + 2;
        return (
          <button
            key={m.key}
            type="button"
            aria-label={m.checked ? 'Mark as not done' : 'Mark as done'}
            aria-pressed={m.checked}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              applyToggle(api, m.ownerId, m.lineIndex);
            }}
            className={
              'pointer-events-auto absolute rounded-[3px] border-2 transition-colors ' +
              (m.checked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/60 bg-background hover:border-foreground')
            }
            style={{
              left,
              top,
              width: size,
              height: size,
              // Hide the underlying `[ ]`/`[x]` text glyphs by sitting on
              // top of them — Excalidraw renders them in dark text and
              // we want the rendered box to be the only mark visible.
            }}
          >
            {m.checked && (
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className="h-full w-full"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8.5 L7 12 L13 4" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

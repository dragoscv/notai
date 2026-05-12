'use client';
import * as React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Phase-2 of the Excalidraw migration: heading presets on canvas text.
 *
 * Notion / TipTap users expect H1/H2/H3 to be a one-keystroke promotion.
 * Excalidraw's text element is a single styled run with no concept of
 * block-level heading semantics, so we map heading levels to:
 *
 *   - `fontSize` (32 / 24 / 20 / 16 for H1 / H2 / H3 / body)
 *   - `customData.style` (`'h1' | 'h2' | 'h3' | 'body'`) for downstream
 *     theming, search ranking, and outline extraction.
 *
 * The toolbar floats at the top of the canvas while exactly one text
 * element is selected. It is render-only (does not touch the scene
 * unless the user clicks); selection tracking subscribes to the same
 * `api.onChange` Excalidraw uses internally, so it costs one observer.
 */

type AnyEl = ExcalidrawElement & {
  text?: string;
  fontSize?: number;
  customData?: Record<string, unknown> | null;
};

export type HeadingStyle = 'h1' | 'h2' | 'h3' | 'body';

const FONT_SIZE: Record<HeadingStyle, number> = {
  h1: 32,
  h2: 24,
  h3: 20,
  body: 16,
};

function detectStyle(el: AnyEl): HeadingStyle {
  const tagged = (el.customData as { style?: string } | null)?.style;
  if (tagged === 'h1' || tagged === 'h2' || tagged === 'h3' || tagged === 'body') {
    return tagged;
  }
  // Fallback: infer from font size so existing canvases get sensible
  // defaults the moment a user opens the toolbar.
  const fs = el.fontSize ?? 16;
  if (fs >= 30) return 'h1';
  if (fs >= 22) return 'h2';
  if (fs >= 19) return 'h3';
  return 'body';
}

interface SelectionState {
  id: string;
  style: HeadingStyle;
}

function useSelectedText(api: ExcalidrawImperativeAPI | null): SelectionState | null {
  const [sel, setSel] = React.useState<SelectionState | null>(null);

  React.useEffect(() => {
    if (!api) return;
    const compute = () => {
      const appState = api.getAppState() as {
        selectedElementIds?: Record<string, boolean>;
      };
      const selectedIds = Object.entries(appState.selectedElementIds ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (selectedIds.length !== 1) {
        setSel((prev) => (prev === null ? prev : null));
        return;
      }
      const els = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
      const el = els.find((e) => e.id === selectedIds[0]);
      if (!el || el.type !== 'text' || el.isDeleted) {
        setSel((prev) => (prev === null ? prev : null));
        return;
      }
      const next: SelectionState = { id: el.id, style: detectStyle(el) };
      setSel((prev) => {
        if (prev && prev.id === next.id && prev.style === next.style) return prev;
        return next;
      });
    };
    compute();
    const unsub = api.onChange(() => compute());
    return () => unsub();
  }, [api]);

  return sel;
}

function applyHeadingStyle(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  style: HeadingStyle,
): void {
  const elements = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
  const target = elements.find((e) => e.id === elementId);
  if (!target || target.type !== 'text') return;

  const fontSize = FONT_SIZE[style];
  const next = elements.map((el) => {
    if (el.id !== elementId) return el;
    const merged: AnyEl = {
      ...el,
      fontSize,
      customData: { ...(el.customData ?? {}), style },
      version: ((el as { version?: number }).version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 0x7fffffff),
    };
    // Bump height proportionally so the existing text doesn't clip until
    // Excalidraw re-measures on the next interaction.
    const oldFs = (el.fontSize ?? 16) as number;
    if (oldFs > 0) {
      const ratio = fontSize / oldFs;
      const oldHeight = (el as { height?: number }).height ?? fontSize;
      (merged as { height?: number }).height = Math.round(oldHeight * ratio);
    }
    return merged;
  });

  type SceneUpdateArg = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];
  api.updateScene({
    elements: next as unknown as SceneUpdateArg extends { elements?: infer E } ? E : never,
  } as SceneUpdateArg);
}

/**
 * Line-prefix transformations for list / checklist toggles. Operates on
 * the element's plain text — completely interoperable with TipTap,
 * Markdown export, and any future renderer.
 */
type ListMode = 'bullet' | 'numbered' | 'check';

const RE_BULLET = /^(\s*)[-*]\s+(?!\[)/;
const RE_NUMBERED = /^(\s*)\d+\.\s+/;
const RE_CHECK = /^(\s*)(?:[-*]\s+)?\[ \]\s+/;
const RE_CHECK_DONE = /^(\s*)(?:[-*]\s+)?\[[xX]\]\s+/;
const RE_ANY_PREFIX = /^(\s*)(?:(?:[-*]\s+)?\[[ xX]\]\s+|[-*]\s+|\d+\.\s+)/;

function toggleListLines(text: string, mode: ListMode): string {
  const lines = text.split('\n');
  const allMatch = lines.every((l) => l.trim().length === 0 || matchesMode(l, mode));
  if (allMatch) {
    // Remove the prefix on every non-empty line.
    return lines.map((l) => l.replace(RE_ANY_PREFIX, '$1')).join('\n');
  }
  // Apply prefix to every non-empty line that doesn't already match.
  let counter = 0;
  return lines
    .map((l) => {
      if (l.trim().length === 0) return l;
      const stripped = l.replace(RE_ANY_PREFIX, '$1');
      const indent = /^(\s*)/.exec(stripped)?.[1] ?? '';
      const body = stripped.slice(indent.length);
      if (mode === 'bullet') return `${indent}- ${body}`;
      if (mode === 'numbered') {
        counter += 1;
        return `${indent}${counter}. ${body}`;
      }
      return `${indent}- [ ] ${body}`;
    })
    .join('\n');
}

function matchesMode(line: string, mode: ListMode): boolean {
  if (mode === 'bullet') return RE_BULLET.test(line);
  if (mode === 'numbered') return RE_NUMBERED.test(line);
  return RE_CHECK.test(line) || RE_CHECK_DONE.test(line);
}

function applyListMode(api: ExcalidrawImperativeAPI, elementId: string, mode: ListMode): void {
  const elements = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
  const target = elements.find((e) => e.id === elementId);
  if (!target || target.type !== 'text') return;
  const nextText = toggleListLines(target.text ?? '', mode);
  if (nextText === (target.text ?? '')) return;

  const next = elements.map((el) => {
    if (el.id !== elementId) return el;
    return {
      ...el,
      text: nextText,
      version: ((el as { version?: number }).version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 0x7fffffff),
    } as AnyEl;
  });
  type SceneUpdateArg = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];
  api.updateScene({
    elements: next as unknown as SceneUpdateArg extends { elements?: infer E } ? E : never,
  } as SceneUpdateArg);
}

function detectListMode(text: string): ListMode | null {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  if (lines.every((l) => RE_CHECK.test(l) || RE_CHECK_DONE.test(l))) return 'check';
  if (lines.every((l) => RE_BULLET.test(l))) return 'bullet';
  if (lines.every((l) => RE_NUMBERED.test(l))) return 'numbered';
  return null;
}

/**
 * Excalidraw font family identifiers (stable across the released
 * versions we pin): 1 = Virgil, 2 = Helvetica, 3 = Cascadia (monospace),
 * 4 = serif. We toggle the selected text between Helvetica and
 * Cascadia for the Code preset and tag `customData.kind = 'code'` so a
 * future syntax-highlighting renderer can opt in without re-detecting.
 */
const FONT_FAMILY_BODY = 2;
const FONT_FAMILY_CODE = 3;

function isCode(el: AnyEl): boolean {
  return (el.customData as { kind?: string } | null)?.kind === 'code';
}

function applyCodeToggle(api: ExcalidrawImperativeAPI, elementId: string): void {
  const elements = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
  const target = elements.find((e) => e.id === elementId);
  if (!target || target.type !== 'text') return;
  const turningOn = !isCode(target);

  const next = elements.map((el) => {
    if (el.id !== elementId) return el;
    const customData = { ...(el.customData ?? {}) } as Record<string, unknown>;
    if (turningOn) {
      customData.kind = 'code';
    } else {
      delete customData.kind;
    }
    return {
      ...el,
      fontFamily: turningOn ? FONT_FAMILY_CODE : FONT_FAMILY_BODY,
      customData,
      version: ((el as { version?: number }).version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 0x7fffffff),
    } as AnyEl;
  });
  type SceneUpdateArg = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];
  api.updateScene({
    elements: next as unknown as SceneUpdateArg extends { elements?: infer E } ? E : never,
  } as SceneUpdateArg);
}

type ExWithGroups = AnyEl & {
  groupIds?: readonly string[];
  containerId?: string | null;
  boundElements?: Array<{ id: string; type: string }> | null;
};

function findCalloutContainer(
  elements: readonly ExWithGroups[],
  textEl: ExWithGroups,
): ExWithGroups | null {
  // Look for a rectangle whose customData.kind === 'callout' and which
  // shares a group with the text element OR has it bound.
  const groupIds = new Set(textEl.groupIds ?? []);
  for (const el of elements) {
    if (el.id === textEl.id) continue;
    if ((el.customData as { kind?: string } | null)?.kind !== 'callout') continue;
    if ((el.groupIds ?? []).some((g) => groupIds.has(g))) return el;
    if ((el.boundElements ?? []).some((b) => b.id === textEl.id)) return el;
  }
  return null;
}

function applyCalloutToggle(api: ExcalidrawImperativeAPI, elementId: string): void {
  const elements = api.getSceneElementsIncludingDeleted() as readonly ExWithGroups[];
  const text = elements.find((e) => e.id === elementId) as ExWithGroups | undefined;
  if (!text || text.type !== 'text') return;
  const existing = findCalloutContainer(elements, text);

  type SceneUpdateArg = Parameters<ExcalidrawImperativeAPI['updateScene']>[0];

  if (existing) {
    // Toggle off: drop the callout rectangle, ungroup the text from it,
    // restore the text's previous group memberships untouched.
    const next = elements
      .filter((el) => el.id !== existing.id)
      .map((el) => {
        if (el.id !== text.id) return el;
        const groupIds = (el.groupIds ?? []).filter((g) => !(existing.groupIds ?? []).includes(g));
        return {
          ...el,
          groupIds,
          version: ((el as { version?: number }).version ?? 1) + 1,
          versionNonce: Math.floor(Math.random() * 0x7fffffff),
        } as ExWithGroups;
      });
    api.updateScene({
      elements: next as unknown as SceneUpdateArg extends { elements?: infer E } ? E : never,
    } as SceneUpdateArg);
    return;
  }

  // Toggle on: create a rounded rectangle behind the text, place them in
  // a shared group. Sized with comfortable padding so the text breathes.
  const padX = 16;
  const padY = 12;
  const x = (text.x ?? 0) - padX;
  const y = (text.y ?? 0) - padY;
  const width = ((text as { width?: number }).width ?? 200) + padX * 2;
  const height = ((text as { height?: number }).height ?? 24) + padY * 2;
  const groupId = `callout-${text.id}`;

  const rect = {
    id: `callout-rect-${text.id}`,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#0c8599',
    backgroundColor: '#e3fafc',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    seed: Math.floor(Math.random() * 0x7fffffff),
    version: 1,
    versionNonce: Math.floor(Math.random() * 0x7fffffff),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { kind: 'callout' },
    // Excalidraw fills `roundness` + `index` on next restoreElements pass;
    // we just need a valid-enough literal to get into the scene.
  } as unknown as ExWithGroups;

  // Insert rect before text so it renders behind, then update text to
  // join the same group.
  const next: ExWithGroups[] = [];
  for (const el of elements) {
    if (el.id === text.id) {
      next.push(rect);
      next.push({
        ...el,
        groupIds: [...(el.groupIds ?? []), groupId],
        version: ((el as { version?: number }).version ?? 1) + 1,
        versionNonce: Math.floor(Math.random() * 0x7fffffff),
      } as ExWithGroups);
    } else {
      next.push(el);
    }
  }
  api.updateScene({
    elements: next as unknown as SceneUpdateArg extends { elements?: infer E } ? E : never,
  } as SceneUpdateArg);
}

export interface ExcalidrawHeadingsLabels {
  h1: string;
  h1Hint: string;
  h2: string;
  h2Hint: string;
  h3: string;
  h3Hint: string;
  body: string;
  bodyHint: string;
  bullet: string;
  bulletHint: string;
  numbered: string;
  numberedHint: string;
  check: string;
  checkHint: string;
  monospace: string;
  callout: string;
}

const DEFAULT_HEADINGS_LABELS: ExcalidrawHeadingsLabels = {
  h1: 'H1',
  h1Hint: 'Title',
  h2: 'H2',
  h2Hint: 'Heading',
  h3: 'H3',
  h3Hint: 'Subheading',
  body: 'Body',
  bodyHint: 'Body text',
  bullet: '•',
  bulletHint: 'Bullet list',
  numbered: '1.',
  numberedHint: 'Numbered list',
  check: '☐',
  checkHint: 'Checklist',
  monospace: 'Monospace / code',
  callout: 'Callout (highlighted box)',
};

export interface ExcalidrawHeadingsToolbarProps {
  api: ExcalidrawImperativeAPI | null;
  /** Suppress the toolbar (sticky read-only mirrors, etc.). */
  enabled?: boolean;
  /** Localized strings. English defaults are used when omitted. */
  labels?: ExcalidrawHeadingsLabels;
}

/**
 * Floating format bar (heading presets + list toggles). Renders nothing
 * unless exactly one text element is selected. Pure render except for
 * the button click handlers.
 */
export function ExcalidrawHeadingsToolbar({
  api,
  enabled = true,
  labels = DEFAULT_HEADINGS_LABELS,
}: ExcalidrawHeadingsToolbarProps): React.ReactElement | null {
  const sel = useSelectedText(enabled ? api : null);
  // Re-derive the active list mode whenever selection identity changes;
  // we read it from the live scene because text edits don't bump the
  // selection-state object that `useSelectedText` returns.
  const activeListMode = React.useMemo<ListMode | null>(() => {
    if (!api || !sel) return null;
    const els = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
    const el = els.find((e) => e.id === sel.id);
    return el ? detectListMode((el.text ?? '') as string) : null;
  }, [api, sel]);

  const codeActive = React.useMemo<boolean>(() => {
    if (!api || !sel) return false;
    const els = api.getSceneElementsIncludingDeleted() as readonly AnyEl[];
    const el = els.find((e) => e.id === sel.id);
    return el ? isCode(el) : false;
  }, [api, sel]);

  const calloutActive = React.useMemo<boolean>(() => {
    if (!api || !sel) return false;
    const els = api.getSceneElementsIncludingDeleted() as readonly ExWithGroups[];
    const el = els.find((e) => e.id === sel.id) as ExWithGroups | undefined;
    return !!(el && findCalloutContainer(els, el));
  }, [api, sel]);

  if (!enabled || !api || !sel) return null;

  const styles: Array<{ key: HeadingStyle; label: string; hint: string }> = [
    { key: 'h1', label: labels.h1, hint: labels.h1Hint },
    { key: 'h2', label: labels.h2, hint: labels.h2Hint },
    { key: 'h3', label: labels.h3, hint: labels.h3Hint },
    { key: 'body', label: labels.body, hint: labels.bodyHint },
  ];

  const lists: Array<{ key: ListMode; label: string; hint: string }> = [
    { key: 'bullet', label: labels.bullet, hint: labels.bulletHint },
    { key: 'numbered', label: labels.numbered, hint: labels.numberedHint },
    { key: 'check', label: labels.check, hint: labels.checkHint },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center"
      data-focus-hide
    >
      <div className="border-border bg-popover/95 pointer-events-auto flex items-center gap-1 rounded-full border px-1.5 py-1 shadow-md backdrop-blur">
        {styles.map((s) => {
          const active = sel.style === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHeadingStyle(api, sel.id, s.key)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                (active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
              title={s.hint}
              aria-pressed={active}
            >
              {s.label}
            </button>
          );
        })}
        <span className="bg-border mx-1 h-4 w-px" aria-hidden />
        {lists.map((l) => {
          const active = activeListMode === l.key;
          return (
            <button
              key={l.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyListMode(api, sel.id, l.key)}
              className={
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors ' +
                (active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
              title={l.hint}
              aria-pressed={active}
            >
              {l.label}
            </button>
          );
        })}
        <span className="bg-border mx-1 h-4 w-px" aria-hidden />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyCodeToggle(api, sel.id)}
          className={
            'rounded-full px-2.5 py-1 font-mono text-xs font-medium transition-colors ' +
            (codeActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground')
          }
          title={labels.monospace}
          aria-pressed={codeActive}
        >
          {'</>'}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyCalloutToggle(api, sel.id)}
          className={
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors ' +
            (calloutActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground')
          }
          title={labels.callout}
          aria-pressed={calloutActive}
        >
          ❝
        </button>
      </div>
    </div>
  );
}

'use client';
import * as React from 'react';

interface ExTextElement {
  id: string;
  type: 'text';
  text: string;
  isDeleted?: boolean;
  // Excalidraw text elements carry width/height auto-calculated; we don't
  // tweak geometry here, only the `text` field.
}

interface ExSceneElement {
  id: string;
  type: string;
  isDeleted?: boolean;
  text?: string;
}

interface ExApi {
  getSceneElements(): readonly ExSceneElement[];
  getSceneElementsIncludingDeleted(): readonly ExSceneElement[];
  getAppState(): { selectedElementIds: Record<string, boolean> };
  updateScene(scene: {
    elements: ExSceneElement[];
    captureUpdate?: 'NEVER' | 'IMMEDIATELY' | 'EVENTUALLY';
  }): void;
}

interface Props {
  getApi: () => ExApi | null;
}

const BULLET_RE = /^(\s*)([-*+]\s+|\[[ xX]\]\s+|\d+[.)]\s+)(.*)$/;

/**
 * Cmd/Ctrl+Shift+↑/↓ moves the current line of a selected Excalidraw
 * text element up or down — but only when the line looks like a
 * bullet, todo, or numbered list item. Falling back to the editor's
 * native behaviour for non-list lines avoids stealing arrow keys from
 * regular paragraphs.
 *
 * "Current line" = whatever line the caret is on if the text element
 * is being edited (we read `window.getSelection()`); otherwise the
 * first list line.
 */
export function BulletReorder({ getApi }: Props) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const api = getApi();
      if (!api) return;
      const state = api.getAppState();
      const selectedIds = Object.keys(state.selectedElementIds || {}).filter(
        (id) => state.selectedElementIds[id],
      );
      if (selectedIds.length !== 1) return;
      const targetId = selectedIds[0]!;
      const all = api.getSceneElementsIncludingDeleted();
      const target = all.find((el) => el.id === targetId && el.type === 'text' && !el.isDeleted) as
        | ExTextElement
        | undefined;
      if (!target) return;

      const lines = (target.text ?? '').split('\n');
      // Pick the line currently being edited; fall back to first list line.
      const sel = window.getSelection?.();
      let lineIdx = -1;
      if (sel && sel.anchorNode && sel.anchorNode.textContent != null) {
        // When Excalidraw's textarea is open, we get a textarea selection,
        // not a window selection — try anchor first, then a heuristic.
        const node = sel.anchorNode as Node & { value?: string };
        if (typeof (node as HTMLTextAreaElement).value === 'string') {
          const ta = node as unknown as HTMLTextAreaElement;
          const upTo = ta.value.slice(0, ta.selectionStart ?? 0);
          lineIdx = upTo.split('\n').length - 1;
        }
      }
      const active = document.activeElement as HTMLTextAreaElement | null;
      if (lineIdx < 0 && active && active.tagName === 'TEXTAREA') {
        const upTo = active.value.slice(0, active.selectionStart ?? 0);
        lineIdx = upTo.split('\n').length - 1;
      }
      if (lineIdx < 0) {
        lineIdx = lines.findIndex((l) => BULLET_RE.test(l));
      }
      if (lineIdx < 0 || lineIdx >= lines.length) return;
      if (!BULLET_RE.test(lines[lineIdx]!)) return;

      const targetIdx = e.key === 'ArrowUp' ? lineIdx - 1 : lineIdx + 1;
      if (targetIdx < 0 || targetIdx >= lines.length) return;
      // Only swap with another list line — keeps prose paragraphs put.
      if (!BULLET_RE.test(lines[targetIdx]!)) return;

      e.preventDefault();
      e.stopPropagation();
      const newLines = lines.slice();
      const tmp = newLines[lineIdx]!;
      newLines[lineIdx] = newLines[targetIdx]!;
      newLines[targetIdx] = tmp;
      const nextText = newLines.join('\n');

      const next = all.map((el) => (el.id === target.id ? { ...el, text: nextText } : el));
      api.updateScene({ elements: next, captureUpdate: 'IMMEDIATELY' });
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as never);
  }, [getApi]);

  return null;
}

'use client';

import * as React from 'react';
import type { CanvasNoteHandle } from '@notai/editor';
import { expandSnippets, useSnippets } from '@/lib/snippets';

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
 * Watches the canvas for text elements containing `::name` patterns and
 * rewrites them in place using the user's snippet store. Pure
 * client-side; no AI / network calls.
 */
export function CanvasSnippets({
  canvasRef,
}: {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}) {
  const snippets = useSnippets();
  const inflightRef = React.useRef(false);
  const snippetsRef = React.useRef(snippets);
  React.useEffect(() => {
    snippetsRef.current = snippets;
  }, [snippets]);

  React.useEffect(() => {
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) return;
    const off = api.onChange(() => {
      if (inflightRef.current) return;
      const list = snippetsRef.current;
      if (list.length === 0) return;
      const all = api.getSceneElementsIncludingDeleted();
      let dirty = false;
      const next: SceneElement[] = [];
      for (const el of all) {
        if (el.isDeleted || el.type !== 'text') {
          next.push(el);
          continue;
        }
        const text = el.text ?? '';
        if (!text.includes('::')) {
          next.push(el);
          continue;
        }
        const expanded = expandSnippets(text, list);
        if (expanded === text) {
          next.push(el);
          continue;
        }
        dirty = true;
        next.push({
          ...el,
          text: expanded,
          version: (el.version ?? 0) + 1,
          updated: Date.now(),
        });
      }
      if (!dirty) return;
      inflightRef.current = true;
      api.updateScene({ elements: next });
      setTimeout(() => {
        inflightRef.current = false;
      }, 50);
    });
    return off;
  }, [canvasRef]);
  return null;
}

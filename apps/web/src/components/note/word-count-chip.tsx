'use client';

import * as React from 'react';
import type { CanvasNoteHandle } from '@notai/editor';

interface SceneEl {
  type: string;
  text?: string;
  isDeleted?: boolean;
}

interface ExApi {
  getSceneElements(): readonly SceneEl[];
  onChange(cb: () => void): () => void;
}

const WPM = 220;

/**
 * Live word count + reading time chip. Reads text elements off the
 * canvas via `getSceneElements()` and recomputes on each Excalidraw
 * change event. Lightweight: just a string concat + split.
 */
export function WordCountChip({
  canvasRef,
}: {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}) {
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) return;
    const tick = () => {
      const all = api.getSceneElements();
      const out: string[] = [];
      for (const el of all) {
        if (el.isDeleted || el.type !== 'text') continue;
        if (el.text) out.push(el.text);
      }
      setText(out.join(' '));
    };
    tick();
    return api.onChange(tick);
  }, [canvasRef]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  if (words === 0) return null;

  const minutes = Math.max(1, Math.round(words / WPM));
  const label = `${words.toLocaleString()} word${words === 1 ? '' : 's'} \u00b7 ${minutes} min read`;

  return (
    <span
      className="text-muted-foreground/80 hidden text-[11px] tabular-nums sm:inline"
      title={`Reading time at ${WPM} wpm`}
    >
      {label}
    </span>
  );
}

'use client';
import * as React from 'react';
import * as Y from 'yjs';
import { peekBlocksArray } from './migrate-doc';

/**
 * Reactive count of TipTap text blocks in the note's Y.Doc. Subscribes
 * directly to the Y.Array (and its scene-map parent, in case the array
 * gets installed after sync). Returns -1 while we don't yet know
 * (pre-sync), 0 when the note is pure-Excalidraw, N when blocks remain.
 *
 * Phase-3 of the Excalidraw migration uses this to drive a non-blocking
 * banner suggesting the canvas conversion: notes with N > 0 are still
 * on the legacy editor surface.
 */
export function useBlocksCount(doc: Y.Doc | null): number {
  const [count, setCount] = React.useState<number>(() => {
    if (!doc) return -1;
    const arr = peekBlocksArray(doc);
    return arr ? arr.length : 0;
  });

  React.useEffect(() => {
    if (!doc) return;

    let arr = peekBlocksArray(doc);
    const update = () => {
      const a = peekBlocksArray(doc);
      setCount(a ? a.length : 0);
    };

    if (arr) arr.observe(update);
    update();

    // The blocks array can be installed late (a remote sync replaces the
    // scene map). Watch the parent map for the BLOCKS_KEY appearing.
    const sceneMap = doc.getMap('scene');
    const onSceneChange = () => {
      const next = peekBlocksArray(doc);
      if (next !== arr) {
        if (arr) arr.unobserve(update);
        arr = next;
        if (arr) arr.observe(update);
        update();
      }
    };
    sceneMap.observe(onSceneChange);

    return () => {
      if (arr) arr.unobserve(update);
      sceneMap.unobserve(onSceneChange);
    };
  }, [doc]);

  return count;
}

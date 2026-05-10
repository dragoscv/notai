import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

interface AppendOptions {
  /** When true, scrolls/zooms to the new element after inserting. */
  focus?: boolean;
  /**
   * Optional explicit world coordinates for the new text element. When
   * provided, the placement heuristic (below-lowest / viewport top-left)
   * is bypassed. Used by hold-to-record voice on the canvas surface so
   * the transcript drops where the pointer was held.
   */
  at?: { x: number; y: number };
}

const seed = () => Math.floor(Math.random() * 0x7fffffff);

/**
 * Append free-form text to the live Excalidraw scene as a new text
 * element. Placement: below the lowest existing element (or at the
 * current viewport top-left if the scene is empty), wrapped to ~64
 * chars per line. Returns the new element id.
 *
 * Used by the Quick Capture "Append to <existing note>" flow: rather
 * than mutating the Y.Doc from the server (which would race the
 * realtime provider), we route the user to the target note and let the
 * note workspace replay the captured text into the live scene.
 */
export function appendTextToScene(
  api: ExcalidrawImperativeAPI,
  text: string,
  opts: AppendOptions = {},
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fontSize = 16;
  const lineHeight = 1.35;
  const wrapped = wrapLines(trimmed, 64);
  const longest = Math.max(...wrapped.map((l) => l.length), 1);
  const width = Math.max(160, Math.min(720, Math.ceil(longest * fontSize * 0.6) + 24));
  const height = Math.max(fontSize * lineHeight, wrapped.length * fontSize * lineHeight) + 16;

  const existing = api.getSceneElements();
  let x = 40;
  let y = 40;
  if (opts.at) {
    x = opts.at.x;
    y = opts.at.y;
  } else if (existing.length > 0) {
    let bottom = -Infinity;
    let leftAtBottom = 40;
    for (const el of existing) {
      const elBottom = el.y + (el.height ?? 0);
      if (elBottom > bottom) {
        bottom = elBottom;
        leftAtBottom = el.x;
      }
    }
    x = leftAtBottom;
    y = (bottom === -Infinity ? 40 : bottom) + 32;
  } else {
    const state = api.getAppState();
    x = -state.scrollX + 40;
    y = -state.scrollY + 40;
  }

  const id = `qc-${Date.now().toString(36)}-${seed().toString(36)}`;
  const element = {
    id,
    type: 'text',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    text: wrapped.join('\n'),
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: fontSize,
    containerId: null,
    originalText: wrapped.join('\n'),
    lineHeight,
    locked: false,
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    customData: { quickCaptureAppend: true },
    autoResize: true,
  } as unknown as ExcalidrawElement;

  api.updateScene({
    elements: [...existing, element],
    appState: { selectedElementIds: { [id]: true } },
  });
  if (opts.focus) {
    api.scrollToContent([element], { fitToContent: true, animate: true, duration: 320 });
  }
  return id;
}

function wrapLines(text: string, maxLen: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (para.length <= maxLen) {
      out.push(para);
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!line.length) {
        line = w;
      } else if (line.length + 1 + w.length <= maxLen) {
        line += ` ${w}`;
      } else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

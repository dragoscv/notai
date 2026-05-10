import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * AI-generated mind-map tree shape (mirrors the Zod schema in
 * apps/web/src/server/actions/mind-map.ts).
 */
export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export interface MindMap {
  root: MindMapNode;
}

interface PositionedNode {
  node: MindMapNode;
  x: number;
  y: number;
  depth: number;
  width: number;
  height: number;
  id: string;
  parentId: string | null;
}

/** Conservative pixel width estimate; matches the heuristic in `migrate-blocks-to-excalidraw`. */
function estimateBox(text: string, fontSize: number): { width: number; height: number } {
  const lines = text.split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const lineHeight = 1.35;
  const width = Math.max(120, Math.min(360, Math.ceil(longest * fontSize * 0.6) + 24));
  const height = Math.max(fontSize * lineHeight, lines.length * fontSize * lineHeight) + 20;
  return { width, height };
}

/**
 * Lay out a mind-map tree radially around (cx, cy). Root sits at the
 * centre. Level-1 children are placed on a ring around it and split
 * into wedges; deeper levels recurse inside their parent's wedge.
 *
 * The result is a flat list of positioned nodes, ready for arrow wiring.
 */
function layoutMindMap(map: MindMap, cx: number, cy: number): PositionedNode[] {
  const fontSizes = [20, 16, 14] as const;
  const levelRadii = [0, 280, 480, 660] as const;
  const fontFor = (d: number) => fontSizes[Math.min(d, fontSizes.length - 1)] ?? fontSizes[0];
  const radiusFor = (d: number) => levelRadii[Math.min(d, levelRadii.length - 1)] ?? levelRadii[0];
  const out: PositionedNode[] = [];
  let counter = 0;
  const newId = () => `mm-${Date.now().toString(36)}-${(counter++).toString(36)}`;

  const rootBox = estimateBox(map.root.label, fontFor(0));
  const rootId = newId();
  out.push({
    node: map.root,
    id: rootId,
    parentId: null,
    depth: 0,
    x: cx - rootBox.width / 2,
    y: cy - rootBox.height / 2,
    width: rootBox.width,
    height: rootBox.height,
  });

  const place = (
    children: MindMapNode[],
    parentId: string,
    depth: number,
    angleStart: number,
    angleEnd: number,
  ) => {
    if (!children.length) return;
    const fontSize = fontFor(depth);
    const radius = radiusFor(depth);
    const span = angleEnd - angleStart;
    const step = span / children.length;
    children.forEach((child, i) => {
      const a = angleStart + step * (i + 0.5);
      const cxChild = cx + Math.cos(a) * radius;
      const cyChild = cy + Math.sin(a) * radius;
      const box = estimateBox(child.label, fontSize);
      const id = newId();
      out.push({
        node: child,
        id,
        parentId,
        depth,
        x: cxChild - box.width / 2,
        y: cyChild - box.height / 2,
        width: box.width,
        height: box.height,
      });
      if (child.children && child.children.length) {
        // Each grandchild gets a wedge centred on its parent's angle.
        const wedge = Math.max(step * 0.9, Math.PI / 8);
        place(child.children, id, depth + 1, a - wedge / 2, a + wedge / 2);
      }
    });
  };

  if (map.root.children && map.root.children.length) {
    // First level: full circle, but rotate so the first child starts top-right
    // (so the eye lands on something other than a horizontal node).
    place(map.root.children, rootId, 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
  }
  return out;
}

const PALETTE = [
  { stroke: '#1e1e1e', bg: '#fff7ed' },
  { stroke: '#1e1e1e', bg: '#ecfeff' },
  { stroke: '#1e1e1e', bg: '#f0fdf4' },
  { stroke: '#1e1e1e', bg: '#fdf4ff' },
  { stroke: '#1e1e1e', bg: '#fef9c3' },
  { stroke: '#1e1e1e', bg: '#eef2ff' },
  { stroke: '#1e1e1e', bg: '#fef2f2' },
];

interface ContainerEl {
  id: string;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'solid' | 'hachure';
  strokeWidth: number;
  strokeStyle: 'solid';
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: 3 } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: Array<{ id: string; type: string }>;
  updated: number;
  link: null;
  locked: false;
  customData: { mindMapNode: true; mindMapId: string };
}

interface TextEl {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'solid';
  strokeWidth: number;
  strokeStyle: 'solid';
  roughness: number;
  opacity: number;
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: 'center';
  verticalAlign: 'middle';
  baseline: number;
  containerId: string | null;
  originalText: string;
  lineHeight: number;
  locked: false;
  groupIds: string[];
  frameId: null;
  boundElements: null;
  updated: number;
  link: null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  customData: { mindMapText: true };
  autoResize: false;
}

interface ArrowEl {
  id: string;
  type: 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: 'transparent';
  fillStyle: 'solid';
  strokeWidth: number;
  strokeStyle: 'solid';
  roughness: number;
  opacity: number;
  points: Array<[number, number]>;
  lastCommittedPoint: null;
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
  startArrowhead: null;
  endArrowhead: 'arrow';
  groupIds: string[];
  frameId: null;
  roundness: { type: 2 } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: null;
  updated: number;
  link: null;
  locked: false;
  customData: { mindMapEdge: true };
  elbowed?: false;
}

const seed = () => Math.floor(Math.random() * 0x7fffffff);

function makeContainer(p: PositionedNode): ContainerEl {
  const palette = PALETTE[p.depth % PALETTE.length] ?? PALETTE[0]!;
  return {
    id: p.id,
    type: 'rectangle',
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    angle: 0,
    strokeColor: palette.stroke,
    backgroundColor: p.depth === 0 ? '#fde68a' : palette.bg,
    fillStyle: 'solid',
    strokeWidth: p.depth === 0 ? 2 : 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: [{ id: `${p.id}-text`, type: 'text' }],
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { mindMapNode: true, mindMapId: p.id },
  };
}

function makeText(p: PositionedNode, fontSize: number): TextEl {
  return {
    id: `${p.id}-text`,
    type: 'text',
    x: p.x,
    y: p.y + p.height / 2 - (fontSize * 1.35) / 2,
    width: p.width,
    height: fontSize * 1.35,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    text: p.node.label,
    fontSize,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    baseline: fontSize,
    containerId: p.id,
    originalText: p.node.label,
    lineHeight: 1.35,
    locked: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    customData: { mindMapText: true },
    autoResize: false,
  };
}

function makeArrow(parent: PositionedNode, child: PositionedNode): ArrowEl {
  // Start at parent centre; Excalidraw resolves binding focus when bindings are present.
  const px = parent.x + parent.width / 2;
  const py = parent.y + parent.height / 2;
  const cx = child.x + child.width / 2;
  const cy = child.y + child.height / 2;
  const dx = cx - px;
  const dy = cy - py;
  return {
    id: `arrow-${parent.id}-${child.id}`,
    type: 'arrow',
    x: px,
    y: py,
    width: Math.abs(dx),
    height: Math.abs(dy),
    angle: 0,
    strokeColor: '#94a3b8',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1.5,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    points: [
      [0, 0],
      [dx, dy],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: parent.id, focus: 0, gap: 6 },
    endBinding: { elementId: child.id, focus: 0, gap: 6 },
    startArrowhead: null,
    endArrowhead: 'arrow',
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { mindMapEdge: true },
  };
}

/**
 * Insert an AI-generated mind map into the live Excalidraw scene.
 * The map is centred on whatever the user is currently looking at,
 * existing elements are preserved, and the freshly-inserted nodes are
 * selected so the user sees what just happened.
 */
export interface InsertMindMapOptions {
  /**
   * When true, all previously-inserted mind-map elements (containers,
   * text, edges) are tombstoned (`isDeleted: true`) before the new map
   * lands. This keeps regeneration idempotent: clicking "Generate mind
   * map" twice replaces the previous map rather than stacking maps.
   */
  replace?: boolean;
}

const MIND_MAP_KEYS = ['mindMapNode', 'mindMapText', 'mindMapEdge'] as const;
type MindMapKey = (typeof MIND_MAP_KEYS)[number];

function isMindMapElement(el: ExcalidrawElement): boolean {
  const data = (el as { customData?: Partial<Record<MindMapKey, unknown>> }).customData;
  if (!data) return false;
  return MIND_MAP_KEYS.some((k) => Boolean(data[k]));
}

/** True when the current scene already contains a mind map. */
export function hasMindMap(api: ExcalidrawImperativeAPI): boolean {
  return api.getSceneElements().some((el) => !el.isDeleted && isMindMapElement(el));
}

/**
 * Insert an AI-generated mind map into the live Excalidraw scene.
 * The map is centred on whatever the user is currently looking at,
 * existing elements are preserved, and the freshly-inserted nodes are
 * selected so the user sees what just happened.
 */
export function insertMindMap(
  api: ExcalidrawImperativeAPI,
  map: MindMap,
  options: InsertMindMapOptions = {},
): void {
  const state = api.getAppState();
  // Centre the map on the current viewport.
  const { width: vw, height: vh, scrollX, scrollY, zoom } = state;
  const cx = -scrollX + vw / zoom.value / 2;
  const cy = -scrollY + vh / zoom.value / 2;
  const positioned = layoutMindMap(map, cx, cy);

  const containers: ContainerEl[] = [];
  const texts: TextEl[] = [];
  const arrows: ArrowEl[] = [];
  const fontSizes = [20, 16, 14] as const;

  for (const p of positioned) {
    containers.push(makeContainer(p));
    const fs = fontSizes[Math.min(p.depth, fontSizes.length - 1)] ?? fontSizes[0];
    texts.push(makeText(p, fs));
    if (p.parentId) {
      const parent = positioned.find((x) => x.id === p.parentId);
      if (parent) arrows.push(makeArrow(parent, p));
    }
  }

  // Wire arrows back into their bound containers' `boundElements` so dragging keeps the link.
  for (const a of arrows) {
    if (a.startBinding) {
      const c = containers.find((x) => x.id === a.startBinding!.elementId);
      if (c) c.boundElements = [...c.boundElements, { id: a.id, type: 'arrow' }];
    }
    if (a.endBinding) {
      const c = containers.find((x) => x.id === a.endBinding!.elementId);
      if (c) c.boundElements = [...c.boundElements, { id: a.id, type: 'arrow' }];
    }
  }

  const fresh = [...containers, ...texts, ...arrows];
  const existing = api.getSceneElements();
  // When replacing, tombstone any previous mind-map elements. Excalidraw's
  // delete semantics work via `isDeleted: true` on the element record;
  // the renderer will hide and gc them on next persist.
  const merged = options.replace
    ? existing.map((el) =>
        isMindMapElement(el)
          ? ({ ...el, isDeleted: true, updated: Date.now() } as ExcalidrawElement)
          : el,
      )
    : [...existing];
  api.updateScene({
    elements: [...merged, ...(fresh as unknown as ExcalidrawElement[])],
    appState: {
      selectedElementIds: Object.fromEntries(containers.map((c) => [c.id, true])),
    },
  });

  // Pan/zoom to the new map so the user lands on it.
  api.scrollToContent(fresh as unknown as ExcalidrawElement[], {
    fitToContent: true,
    animate: true,
    duration: 400,
  });
}

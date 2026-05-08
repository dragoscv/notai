import * as Y from 'yjs';

/**
 * Canvas-first scene model.
 *
 * A note's Y.Doc is a single Excalidraw scene plus a list of positioned
 * text blocks. Each block has a stable id and lives at world coordinates
 * (x, y, width). Block height is auto-fit to its TipTap content. Both
 * layers share the same {scrollX, scrollY, zoom} from Excalidraw, so
 * panning and ctrl+wheel zoom apply to text and drawings as one.
 *
 * Y.Doc shape:
 *   - getMap('scene').get('blocks')      → Y.Array<SceneBlock>
 *   - getMap('blocks-content').get(id)   → Y.XmlFragment (TipTap content)
 *   - getMap('excalidraw').get('elements') → drawings (unchanged)
 *   - getMap('meta').get('title')        → Y.Text (unchanged)
 *
 * Legacy notes use getXmlFragment('default'|'prosemirror') for prose. On
 * first open we materialize one block referencing that fragment via the
 * sentinel id `__legacy__` rather than copying content (which would lose
 * CRDT history). New blocks always get fresh fragments under
 * `blocks-content`.
 */

export interface SceneBlock {
  id: string;
  /** World x in CSS px. */
  x: number;
  /** World y in CSS px. */
  y: number;
  /** Width in world CSS px; height auto-fits content. */
  width: number;
}

export const SCENE_MAP = 'scene';
export const BLOCKS_KEY = 'blocks';
export const BLOCKS_CONTENT_MAP = 'blocks-content';
export const LEGACY_BLOCK_ID = '__legacy__';
export const LEGACY_FRAGMENT_KEY = 'default';
const LEGACY_FRAGMENT_KEY_ALT = 'prosemirror';

const DEFAULT_BLOCK_WIDTH = 760;
const DEFAULT_BLOCK_X = 40;
const DEFAULT_BLOCK_Y = 40;

export function getBlocksArray(doc: Y.Doc): Y.Array<SceneBlock> {
  const scene = doc.getMap(SCENE_MAP);
  let arr = scene.get(BLOCKS_KEY) as Y.Array<SceneBlock> | undefined;
  if (!arr) {
    arr = new Y.Array<SceneBlock>();
    scene.set(BLOCKS_KEY, arr);
  }
  return arr;
}

/**
 * Resolve a block id to its TipTap content fragment. Legacy block routes
 * to the unprefixed top-level XmlFragment so existing collaborative
 * history is preserved verbatim.
 */
export function getBlockFragment(doc: Y.Doc, blockId: string): Y.XmlFragment {
  if (blockId === LEGACY_BLOCK_ID) {
    const main = doc.getXmlFragment(LEGACY_FRAGMENT_KEY);
    if (main.length > 0) return main;
    const alt = doc.getXmlFragment(LEGACY_FRAGMENT_KEY_ALT);
    if (alt.length > 0) return alt;
    return main;
  }
  const map = doc.getMap<Y.XmlFragment>(BLOCKS_CONTENT_MAP);
  let frag = map.get(blockId);
  if (!frag) {
    frag = new Y.XmlFragment();
    map.set(blockId, frag);
  }
  return frag;
}

/**
 * One-shot migration. Idempotent: running it again on a doc that already
 * has blocks is a no-op. Safe to call from any client; if multiple
 * clients race, Yjs deduplicates the array push and at most one block
 * survives (we re-check length inside the transaction).
 */
export function migrateLegacyDoc(doc: Y.Doc): void {
  const blocks = getBlocksArray(doc);
  if (blocks.length > 0) return;

  const legacy = doc.getXmlFragment(LEGACY_FRAGMENT_KEY);
  const legacyAlt = doc.getXmlFragment(LEGACY_FRAGMENT_KEY_ALT);
  const hasLegacyContent = legacy.length > 0 || legacyAlt.length > 0;

  doc.transact(() => {
    if (blocks.length > 0) return;
    if (hasLegacyContent) {
      blocks.push([
        {
          id: LEGACY_BLOCK_ID,
          x: DEFAULT_BLOCK_X,
          y: DEFAULT_BLOCK_Y,
          width: DEFAULT_BLOCK_WIDTH,
        },
      ]);
    } else {
      const id = crypto.randomUUID();
      const map = doc.getMap<Y.XmlFragment>(BLOCKS_CONTENT_MAP);
      map.set(id, new Y.XmlFragment());
      blocks.push([{ id, x: DEFAULT_BLOCK_X, y: DEFAULT_BLOCK_Y, width: DEFAULT_BLOCK_WIDTH }]);
    }
  }, 'migrate-canvas-scene');
}

export function addBlock(
  doc: Y.Doc,
  partial: { x: number; y: number; width?: number },
): SceneBlock {
  const id = crypto.randomUUID();
  const block: SceneBlock = {
    id,
    x: partial.x,
    y: partial.y,
    width: partial.width ?? DEFAULT_BLOCK_WIDTH,
  };
  doc.transact(() => {
    const map = doc.getMap<Y.XmlFragment>(BLOCKS_CONTENT_MAP);
    map.set(id, new Y.XmlFragment());
    getBlocksArray(doc).push([block]);
  }, 'add-block');
  return block;
}

export function updateBlockAt(doc: Y.Doc, index: number, next: SceneBlock): void {
  const arr = getBlocksArray(doc);
  if (index < 0 || index >= arr.length) return;
  doc.transact(() => {
    arr.delete(index, 1);
    arr.insert(index, [next]);
  }, 'update-block');
}

export function deleteBlockAt(doc: Y.Doc, index: number): void {
  const arr = getBlocksArray(doc);
  if (index < 0 || index >= arr.length) return;
  const block = arr.get(index);
  doc.transact(() => {
    arr.delete(index, 1);
    if (block && block.id !== LEGACY_BLOCK_ID) {
      doc.getMap(BLOCKS_CONTENT_MAP).delete(block.id);
    }
  }, 'delete-block');
}

/** Walk every block fragment (legacy + new) and return concatenated text. */
export function extractAllPlaintext(doc: Y.Doc): string {
  const parts: string[] = [];
  const arr = getBlocksArray(doc);
  for (const block of arr.toArray()) {
    const frag = getBlockFragment(doc, block.id);
    const t = fragmentToText(frag);
    if (t) parts.push(t);
  }
  // Fallback for completely unmigrated docs (no scene yet).
  if (parts.length === 0) {
    for (const key of [LEGACY_FRAGMENT_KEY, LEGACY_FRAGMENT_KEY_ALT]) {
      const t = fragmentToText(doc.getXmlFragment(key));
      if (t) parts.push(t);
    }
  }
  return parts.join('\n').slice(0, 100_000);
}

function fragmentToText(frag: Y.XmlFragment): string {
  const xml = frag.toString();
  if (!xml) return '';
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

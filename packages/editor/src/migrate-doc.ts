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
 * Read-only peek at the blocks array. Returns null when the scene map has
 * no array yet — DOES NOT create one.
 *
 * Why this matters: `getBlocksArray` auto-creates an empty Y.Array and
 * sets it on the scene map. If a component reads the array *before* the
 * Hocuspocus provider has synced, the empty array gets installed locally;
 * when sync arrives, the remote map's array replaces the reference and
 * any component still subscribed to the local array silently stops
 * receiving updates ("note shows blank until you switch notes" bug).
 *
 * Read paths (subscribers, snapshots) use `peekBlocksArray`; writers
 * (migration, addBlock, etc.) use `getBlocksArray`.
 */
export function peekBlocksArray(doc: Y.Doc): Y.Array<SceneBlock> | null {
  const scene = doc.getMap(SCENE_MAP);
  const arr = scene.get(BLOCKS_KEY) as Y.Array<SceneBlock> | undefined;
  return arr ?? null;
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
 * Read-only peek for a block's content fragment. Returns null when the
 * fragment hasn't materialized in the local doc yet.
 *
 * Why a peek variant exists: the eager `getBlockFragment` lazy-creates an
 * empty Y.XmlFragment and `map.set(id, frag)` it. If a component binds
 * TipTap to that fragment BEFORE Hocuspocus syncs the real one, the
 * subsequent `map.set(id, remoteFrag)` from sync replaces the reference
 * and the binding becomes orphaned ("note shows blank on refresh until I
 * do something" bug). Render paths use `peekBlockFragment` + observe the
 * blocks-content map for the key so they can re-bind when the real
 * fragment arrives. Writers (addBlock, migrateLegacyDoc) still create
 * intentionally.
 *
 * Legacy block always returns its top-level XmlFragment (Yjs merges
 * top-level fragment edits naturally, so there's no orphan risk).
 */
export function peekBlockFragment(doc: Y.Doc, blockId: string): Y.XmlFragment | null {
  if (blockId === LEGACY_BLOCK_ID) {
    const main = doc.getXmlFragment(LEGACY_FRAGMENT_KEY);
    if (main.length > 0) return main;
    const alt = doc.getXmlFragment(LEGACY_FRAGMENT_KEY_ALT);
    if (alt.length > 0) return alt;
    return main;
  }
  const map = doc.getMap<Y.XmlFragment>(BLOCKS_CONTENT_MAP);
  return map.get(blockId) ?? null;
}

/**
 * One-shot migration. Idempotent: running it again on a doc that already
 * has blocks is a no-op. Safe to call from any client; if multiple
 * clients race, Yjs deduplicates the array push and at most one block
 * survives (we re-check length inside the transaction).
 *
 * Phase-1 of the TipTap removal: brand-new notes (no legacy fragment,
 * no existing blocks) get ZERO TipTap text blocks — they open as a pure
 * Excalidraw canvas, which is the new canonical surface. Legacy notes
 * keep their content via the `__legacy__` block sentinel so nothing is
 * lost while migration tooling is built out.
 */
export function migrateLegacyDoc(doc: Y.Doc): void {
  const blocks = getBlocksArray(doc);
  if (blocks.length > 0) return;

  const legacy = doc.getXmlFragment(LEGACY_FRAGMENT_KEY);
  const legacyAlt = doc.getXmlFragment(LEGACY_FRAGMENT_KEY_ALT);
  const hasLegacyContent = legacy.length > 0 || legacyAlt.length > 0;

  if (!hasLegacyContent) return; // Pure-Excalidraw note: don't seed a block.

  doc.transact(() => {
    if (blocks.length > 0) return;
    blocks.push([
      {
        id: LEGACY_BLOCK_ID,
        x: DEFAULT_BLOCK_X,
        y: DEFAULT_BLOCK_Y,
        width: DEFAULT_BLOCK_WIDTH,
      },
    ]);
  }, 'migrate-canvas-scene');
}

// Phase-3 step-4 retired the block-layer writers. The remaining
// public surface is migration-only: `migrateLegacyDoc`, the read-side\n// helpers (peekBlocksArray, peekBlockFragment, getBlocksArray,\n// getBlockFragment) used by `migrate-blocks-to-excalidraw.ts`, and\n// `extractAllPlaintext` for AI/embedding pipelines.

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

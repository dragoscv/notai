'use client';
import * as Y from 'yjs';
import {
  BLOCKS_CONTENT_MAP,
  LEGACY_BLOCK_ID,
  LEGACY_FRAGMENT_KEY,
  getBlocksArray,
  peekBlockFragment,
  type SceneBlock,
} from './migrate-doc';

/**
 * Phase-1 migration helper: convert TipTap text blocks (the legacy
 * canvas-overlay surface) into native Excalidraw text elements on the
 * same Y.Doc. Idempotent — calling it on a doc that has no blocks is a
 * no-op. Returns the count of blocks migrated.
 *
 * Trade-offs (intentional, documented for the Phase-2 rewrite):
 *   - Rich formatting (headings, bold, lists, callouts, math, mermaid,
 *     toggles, code blocks) collapses to plain text. Phase 2 will add
 *     Excalidraw-native renderers for the structured blocks; for now the
 *     text content is the floor we guarantee.
 *   - Block (x, y) becomes the text element's top-left. Block width is
 *     not enforced — Excalidraw text auto-sizes; users can resize after.
 *   - Migrated blocks are removed from the scene array. Their TipTap
 *     fragments are kept in `blocks-content` for one revision cycle as a
 *     belt-and-braces backup; they're orphaned and never read again, but
 *     can be inspected via Y history if a user reports loss.
 */
export interface MigrationResult {
  /** Number of Excalidraw text elements created. */
  count: number;
  /** Map of original `blockId` → newly-created Excalidraw `elementId`. */
  blockToElement: Record<string, string>;
}

export function migrateBlocksToExcalidraw(doc: Y.Doc): MigrationResult {
  const blocks = getBlocksArray(doc);
  if (blocks.length === 0) return { count: 0, blockToElement: {} };

  const snapshot: Array<{ block: SceneBlock; text: string }> = [];
  for (const block of blocks.toArray()) {
    const text = readBlockText(doc, block.id);
    snapshot.push({ block, text });
  }
  if (snapshot.every((s) => !s.text.trim())) {
    // Empty blocks — drop them silently, no Excalidraw elements created.
    doc.transact(() => {
      while (getBlocksArray(doc).length > 0) {
        getBlocksArray(doc).delete(0, 1);
      }
    }, 'migrate-blocks-empty');
    return { count: 0, blockToElement: {} };
  }

  const exMap = doc.getMap('excalidraw');
  const existingRaw = exMap.get('elements');
  const existing = Array.isArray(existingRaw) ? (existingRaw as unknown[]) : [];

  const nonEmpty = snapshot.filter((s) => s.text.trim().length > 0);
  const blockToElement: Record<string, string> = {};
  const created = nonEmpty.map((s) => {
    const el = makeTextElement(s.block, s.text);
    blockToElement[s.block.id] = el.id;
    return el;
  });

  doc.transact(() => {
    exMap.set('elements', [...existing, ...created]);
    while (getBlocksArray(doc).length > 0) {
      getBlocksArray(doc).delete(0, 1);
    }
  }, 'migrate-blocks-to-excalidraw');

  return { count: created.length, blockToElement };
}

function readBlockText(doc: Y.Doc, blockId: string): string {
  // Legacy block points at the top-level XmlFragment.
  const frag =
    blockId === LEGACY_BLOCK_ID
      ? doc.getXmlFragment(LEGACY_FRAGMENT_KEY)
      : peekBlockFragment(doc, blockId);
  if (!frag) return '';
  return xmlFragmentToText(frag);
}

function xmlFragmentToText(frag: Y.XmlFragment): string {
  const xml = frag.toString();
  if (!xml) return '';
  return xml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|div|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface ExText {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: 'left';
  verticalAlign: 'top';
  baseline: number;
  containerId: null;
  originalText: string;
  lineHeight: number;
  locked: false;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  groupIds: string[];
  frameId: null;
  boundElements: null;
  updated: number;
  link: null;
  customData: { migratedFromBlock: string };
  autoResize: true;
}

function makeTextElement(block: SceneBlock, text: string): ExText {
  const fontSize = 18;
  const lineHeight = 1.35;
  const lines = text.split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const width = Math.max(120, Math.min(block.width || 760, Math.ceil(longest * fontSize * 0.6)));
  const height = Math.max(fontSize * lineHeight, lines.length * fontSize * lineHeight);
  return {
    id: `text-${block.id}`,
    type: 'text',
    x: block.x,
    y: block.y,
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
    text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: fontSize,
    containerId: null,
    originalText: text,
    lineHeight,
    locked: false,
    seed: Math.floor(Math.random() * 0x7fffffff),
    version: 1,
    versionNonce: Math.floor(Math.random() * 0x7fffffff),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    customData: { migratedFromBlock: block.id },
    autoResize: true,
  };
}

void BLOCKS_CONTENT_MAP; // intentional re-export of the map name elsewhere.

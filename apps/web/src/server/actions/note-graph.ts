'use server';

import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull } from '@notai/db';

export interface GraphNode {
  id: string;
  title: string;
  icon: string | null;
  /** outgoing-link count (degree). Used for sizing nodes in the UI. */
  outDegree: number;
  /** incoming-link count. */
  inDegree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const BACKLINK_RE = /\[\[([^[\]\n]{1,200})\]\]/g;
const MAX_NOTES = 500;
const PLAINTEXT_SCAN_CHARS = 20000;

/**
 * Build the user's note graph from `[[Title]]` references in each note's
 * plaintext mirror. Edges are deduplicated per (source, target) pair.
 *
 * Only notes the user owns or collaborates on are visible. We cap at
 * MAX_NOTES to keep the wire payload small; users with bigger
 * workspaces will get their most recently updated subset.
 *
 * The `plaintext` mirror is what's available cheaply server-side
 * (Y.Doc states are not parsed here) — that means a `[[Title]]` written
 * inside an Excalidraw text element shows up because the canvas
 * mirror writes scene text into `plaintext`, and a TipTap-block
 * `[[Note]]` shows up because the plaintext mirror flattens the
 * mention node text. Misses: literal `[[…]]` strings hidden inside
 * collapsed structures we don't mirror, which is rare.
 */
export async function getNoteGraph(): Promise<NoteGraph> {
  const session = await auth();
  if (!session?.user?.id) return { nodes: [], edges: [] };
  const userId = session.user.id;

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .orderBy(notes.updatedAt)
    .limit(MAX_NOTES);

  const byId = new Map<string, { id: string; title: string; icon: string | null }>();
  const titleToId = new Map<string, string>();
  for (const r of rows) {
    byId.set(r.id, { id: r.id, title: r.title || 'Untitled', icon: r.icon ?? null });
    const key = (r.title ?? '').trim().toLowerCase();
    if (key && !titleToId.has(key)) titleToId.set(key, r.id);
  }

  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const out = new Map<string, number>();
  const inn = new Map<string, number>();

  for (const r of rows) {
    const text = (r.plaintext ?? '').slice(0, PLAINTEXT_SCAN_CHARS);
    if (!text) continue;
    BACKLINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BACKLINK_RE.exec(text))) {
      const target = (m[1] ?? '').trim().toLowerCase();
      if (!target) continue;
      const targetId = titleToId.get(target);
      if (!targetId || targetId === r.id) continue;
      const key = `${r.id}\u0000${targetId}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ source: r.id, target: targetId });
      out.set(r.id, (out.get(r.id) ?? 0) + 1);
      inn.set(targetId, (inn.get(targetId) ?? 0) + 1);
    }
  }

  const nodes: GraphNode[] = [];
  for (const n of byId.values()) {
    nodes.push({
      id: n.id,
      title: n.title,
      icon: n.icon,
      outDegree: out.get(n.id) ?? 0,
      inDegree: inn.get(n.id) ?? 0,
    });
  }

  // Sort: most-connected first (more pleasant initial layout).
  nodes.sort(
    (a, b) =>
      b.inDegree + b.outDegree - (a.inDegree + a.outDegree) || a.title.localeCompare(b.title),
  );

  return { nodes, edges };
}

/**
 * 1-hop neighbourhood for a single note — every node it links to and
 * every node that links back. Used by the in-note mini-graph rail.
 * Re-uses the full graph build, then filters; cheap (≤ MAX_NOTES) and
 * keeps the source of truth in one place.
 */
export async function getNoteNeighbourhood(noteId: string): Promise<NoteGraph> {
  const full = await getNoteGraph();
  const center = full.nodes.find((n) => n.id === noteId);
  if (!center) return { nodes: [], edges: [] };

  const neighbourIds = new Set<string>([noteId]);
  for (const e of full.edges) {
    if (e.source === noteId) neighbourIds.add(e.target);
    else if (e.target === noteId) neighbourIds.add(e.source);
  }

  return {
    nodes: full.nodes.filter((n) => neighbourIds.has(n.id)),
    edges: full.edges.filter(
      (e) =>
        neighbourIds.has(e.source) &&
        neighbourIds.has(e.target) &&
        (e.source === noteId || e.target === noteId),
    ),
  };
}

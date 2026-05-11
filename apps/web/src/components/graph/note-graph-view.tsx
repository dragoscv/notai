'use client';
import * as React from 'react';
import Link from 'next/link';
import { FileText, Sparkles } from 'lucide-react';
import type { NoteGraph, GraphNode } from '@/server/actions/note-graph';
import { listActiveViewers, type ActiveViewer } from '@/server/actions/presence';

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Props {
  data: NoteGraph;
}

const WIDTH = 1200;
const HEIGHT = 800;
const ITERATIONS = 220;
// Force-directed constants. Tuned by hand against ~50/200 node graphs;
// `LINK_DIST` controls edge length, `REPULSION` controls how aggressively
// nodes push each other apart, `CENTER` pulls everything toward the
// canvas centre so isolated subgraphs don't drift off-screen.
const LINK_DIST = 110;
const LINK_K = 0.04;
const REPULSION = 9000;
const CENTER = 0.012;
const FRICTION = 0.86;

/**
 * Read-only graph view of every `[[Note]]` reference in the user's
 * workspace. Layout is a tiny Fruchterman-Reingold-ish simulation
 * computed once on mount (no animation, no dep). Click a node to open
 * the note. Hover highlights direct neighbours.
 */
export function NoteGraphView({ data }: Props) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [viewers, setViewers] = React.useState<Map<string, ActiveViewer[]>>(new Map());

  // Poll active viewers every 20s. Server returns rows seen in the last
  // 60s, so a 20s poll gives every node ~3 chances to refresh before a
  // viewer is dropped from the live set.
  React.useEffect(() => {
    if (data.nodes.length === 0) return;
    let cancelled = false;
    const ids = data.nodes.map((n) => n.id);
    const refresh = () => {
      void listActiveViewers(ids)
        .then((rows) => {
          if (cancelled) return;
          const m = new Map<string, ActiveViewer[]>();
          for (const r of rows) {
            const arr = m.get(r.noteId) ?? [];
            arr.push(r);
            m.set(r.noteId, arr);
          }
          setViewers(m);
        })
        .catch(() => undefined);
    };
    refresh();
    const t = window.setInterval(refresh, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [data.nodes]);

  const nodes = React.useMemo<SimNode[]>(() => {
    if (data.nodes.length === 0) return [];
    // Seed positions on a ring so the simulation has a sane starting point.
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const r = Math.min(WIDTH, HEIGHT) * 0.38;
    const seeded: SimNode[] = data.nodes.map((n, i) => {
      const t = (i / data.nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: cx + r * Math.cos(t),
        y: cy + r * Math.sin(t),
        vx: 0,
        vy: 0,
      };
    });
    return runSimulation(seeded, data.edges);
  }, [data.nodes, data.edges]);

  const byId = React.useMemo(() => {
    const m = new Map<string, SimNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const neighbours = React.useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const e of data.edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set());
      if (!adj.has(e.target)) adj.set(e.target, new Set());
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
    return adj;
  }, [data.edges]);

  if (data.nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
        <Sparkles className="size-6 opacity-40" />
        <p>No notes yet — start writing and your graph will grow.</p>
      </div>
    );
  }

  if (data.edges.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm">
        <FileText className="size-6 opacity-40" />
        <p>
          Your notes don&apos;t reference each other yet. Type{' '}
          <code className="bg-muted rounded px-1">[[</code> in any note to start linking — the graph
          will fill in as you go.
        </p>
      </div>
    );
  }

  const isDimmed = (id: string): boolean => {
    if (!hovered) return false;
    if (id === hovered) return false;
    return !(neighbours.get(hovered)?.has(id) ?? false);
  };

  const isEdgeDimmed = (s: string, t: string): boolean => {
    if (!hovered) return false;
    return s !== hovered && t !== hovered;
  };

  return (
    <div className="bg-background relative h-full w-full overflow-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
        role="img"
        aria-label="Note graph"
      >
        {/* Edges */}
        <g stroke="currentColor" strokeOpacity={0.25} strokeWidth={1}>
          {data.edges.map((e, i) => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            if (!a || !b) return null;
            const dim = isEdgeDimmed(e.source, e.target);
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeOpacity={dim ? 0.06 : 0.28} />
            );
          })}
        </g>
        {/* Nodes */}
        <g>
          {nodes.map((n) => {
            const r = Math.min(20, 6 + Math.sqrt(n.inDegree + n.outDegree) * 3);
            const dim = isDimmed(n.id);
            const liveViewers = viewers.get(n.id) ?? [];
            const isLive = liveViewers.length > 0;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                opacity={dim ? 0.25 : 1}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
              >
                <Link href={`/app/n/${n.id}`} aria-label={n.title}>
                  <circle
                    r={r}
                    className="fill-primary/70 hover:fill-primary stroke-background cursor-pointer transition-colors"
                    strokeWidth={2}
                  />
                </Link>
                {isLive && (
                  <circle
                    r={4}
                    cx={r * 0.75}
                    cy={-r * 0.75}
                    className="stroke-background pointer-events-none fill-emerald-500"
                    strokeWidth={1.5}
                  >
                    <title>
                      {liveViewers.length === 1
                        ? `${liveViewers[0]!.name ?? 'Someone'} is here`
                        : `${liveViewers.length} people viewing`}
                    </title>
                  </circle>
                )}
                <text
                  y={r + 12}
                  textAnchor="middle"
                  className="fill-foreground pointer-events-none select-none text-[10px] font-medium"
                >
                  {truncate(n.title, 28)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {hovered && byId.get(hovered) && (
        <HoverCard
          node={byId.get(hovered)!}
          neighbours={neighbours.get(hovered) ?? new Set()}
          byId={byId}
        />
      )}
    </div>
  );
}

function HoverCard({
  node,
  neighbours,
  byId,
}: {
  node: SimNode;
  neighbours: Set<string>;
  byId: Map<string, SimNode>;
}) {
  const linked = Array.from(neighbours)
    .map((id) => byId.get(id))
    .filter((n): n is SimNode => Boolean(n))
    .slice(0, 8);
  return (
    <div className="bg-card text-foreground pointer-events-none absolute right-4 top-4 max-w-xs space-y-1 rounded-lg border p-3 text-xs shadow-md">
      <p className="font-medium">{node.title}</p>
      <p className="text-muted-foreground">
        {node.outDegree} outgoing · {node.inDegree} incoming
      </p>
      {linked.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 pt-1">
          {linked.map((n) => (
            <li key={n.id} className="truncate">
              · {n.title}
            </li>
          ))}
          {neighbours.size > linked.length && (
            <li className="opacity-60">+{neighbours.size - linked.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Tiny Fruchterman-Reingold pass: every iteration applies pairwise
 * repulsion, edge spring forces, and a centre attraction, then damps
 * velocity. Runs synchronously on mount — for the MAX_NOTES cap of 500
 * this completes well under a frame on commodity hardware.
 */
function runSimulation(nodes: SimNode[], edges: { source: string; target: string }[]): SimNode[] {
  const idx = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) idx.set(nodes[i]!.id, i);
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  for (let it = 0; it < ITERATIONS; it++) {
    // Repulsion (O(n²); fine for n ≤ 500).
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = dx * dx + dy * dy + 0.01;
        }
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    // Edge spring.
    for (const e of edges) {
      const ai = idx.get(e.source);
      const bi = idx.get(e.target);
      if (ai == null || bi == null) continue;
      const a = nodes[ai]!;
      const b = nodes[bi]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const delta = (d - LINK_DIST) * LINK_K;
      const fx = (dx / d) * delta;
      const fy = (dy / d) * delta;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    // Centre pull + damping + integrate.
    for (const n of nodes) {
      n.vx += (cx - n.x) * CENTER;
      n.vy += (cy - n.y) * CENTER;
      n.vx *= FRICTION;
      n.vy *= FRICTION;
      n.x += n.vx;
      n.y += n.vy;
      // Soft bounds — keep things on-screen.
      if (n.x < 30) n.x = 30;
      if (n.x > WIDTH - 30) n.x = WIDTH - 30;
      if (n.y < 30) n.y = 30;
      if (n.y > HEIGHT - 30) n.y = HEIGHT - 30;
    }
  }
  return nodes;
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Network } from 'lucide-react';
import { getNoteNeighbourhood } from '@/server/actions/note-graph';
import type { NoteGraph } from '@/server/actions/note-graph';

interface Props {
  noteId: string;
}

const SIZE = 240;
const RADIUS = 92;

/**
 * In-note mini graph — shows the current note as a centre node with
 * its 1-hop neighbours arranged on a circle. Pure SVG, no extra
 * dependencies. Hidden when the note has no neighbours so it doesn't
 * eat space.
 */
export function NoteMiniGraph({ noteId }: Props) {
  const t = useTranslations('editor.minimap');
  const [graph, setGraph] = React.useState<NoteGraph | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void getNoteNeighbourhood(noteId)
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch(() => {
        if (!cancelled) setGraph({ nodes: [], edges: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (!graph || graph.nodes.length <= 1) return null;

  const center = graph.nodes.find((n) => n.id === noteId);
  if (!center) return null;
  const others = graph.nodes.filter((n) => n.id !== noteId);
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(noteId, { x: cx, y: cy });
  others.forEach((n, i) => {
    const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(n.id, {
      x: cx + Math.cos(angle) * RADIUS,
      y: cy + Math.sin(angle) * RADIUS,
    });
  });

  return (
    <aside className="bg-card/60 mt-3 rounded-md border p-3">
      <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
        <Network className="size-3" />
        {t('heading', { count: others.length })}
      </h3>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto block w-full max-w-[260px]"
        role="img"
        aria-label={t('aria', { title: center.title })}
      >
        {graph.edges.map((e, i) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          );
        })}
        {graph.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const isCenter = n.id === noteId;
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
              <Link href={`/app/n/${n.id}`}>
                <circle
                  r={isCenter ? 9 : 6}
                  fill={isCenter ? 'currentColor' : 'var(--background)'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className={isCenter ? 'text-primary' : 'text-foreground/60 hover:text-primary'}
                />
                <title>{n.title}</title>
              </Link>
            </g>
          );
        })}
      </svg>
    </aside>
  );
}

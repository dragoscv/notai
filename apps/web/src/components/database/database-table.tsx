'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { DatabaseProjection } from '@/server/actions/note-properties';

/**
 * Sortable client-side table over a property's notes. Sorting is
 * lexicographic on the rendered string, with a numeric fallback when
 * both cells parse as numbers — good enough until we ship typed
 * filters.
 */
export function DatabaseTable({
  projection,
  primaryKey,
}: {
  projection: DatabaseProjection;
  primaryKey: string;
}) {
  const [sortKey, setSortKey] = React.useState<string>(primaryKey);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const sortedRows = React.useMemo(() => {
    const rows = [...projection.rows];
    rows.sort((a, b) => {
      const av = sortKey === '__title__' ? a.noteTitle : (a.cells[sortKey] ?? '');
      const bv = sortKey === '__title__' ? b.noteTitle : (b.cells[sortKey] ?? '');
      const aNum = Number(av);
      const bNum = Number(bv);
      let cmp: number;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && av !== '' && bv !== '') {
        cmp = aNum - bNum;
      } else {
        cmp = av.localeCompare(bv);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [projection.rows, sortKey, sortDir]);

  function toggle(k: string) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  }

  if (projection.rows.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
        No notes carry this property yet.
      </div>
    );
  }

  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase tracking-wide">
          <tr>
            <Th label="Title" k="__title__" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            {projection.columns.map((c) => (
              <Th key={c} label={c} k={c} sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.noteId} className="hover:bg-accent/40 border-b last:border-b-0">
              <td className="px-3 py-2">
                <Link
                  href={`/app/n/${row.noteId}`}
                  className="hover:text-primary truncate font-medium"
                >
                  {row.noteIcon ? <span className="mr-1">{row.noteIcon}</span> : null}
                  {row.noteTitle || 'Untitled'}
                </Link>
              </td>
              {projection.columns.map((c) => (
                <td key={c} className="text-foreground/80 px-3 py-2 align-top">
                  {row.cells[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  k: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onToggle: (k: string) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="text-left">
      <button
        type="button"
        onClick={() => onToggle(k)}
        className={`flex w-full items-center gap-1 px-3 py-2 text-left ${active ? 'text-foreground' : ''}`}
      >
        {label}
        {active &&
          (sortDir === 'asc' ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          ))}
      </button>
    </th>
  );
}

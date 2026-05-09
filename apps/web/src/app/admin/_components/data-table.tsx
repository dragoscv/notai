import * as React from 'react';
import { cn } from '@notai/lib/utils';

export function DataTable<T extends { id?: string }>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: {
    key: string;
    label: string;
    render: (row: T) => React.ReactNode;
    className?: string;
  }[];
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground p-10 text-center text-sm">{empty ?? 'No data.'}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-2.5 text-left font-medium', c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="hover:bg-muted/30 transition">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from 'next/link';
import { ChevronLeft, Database } from 'lucide-react';
import { listPropertyKeys } from '@/server/actions/note-properties';

export const metadata = { title: 'Databases' };

export default async function DatabasesIndexPage() {
  const keys = await listPropertyKeys();
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/app"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Databases</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Every property key you use becomes a tiny database. Open one to see all notes that share
        that property in a sortable table.
      </p>
      {keys.length === 0 ? (
        <div className="bg-card text-muted-foreground mt-8 rounded-xl border border-dashed px-6 py-10 text-center text-sm">
          No properties yet. Open any note and add one from the Properties panel below the editor.
        </div>
      ) : (
        <ul className="mt-6 space-y-1.5">
          {keys.map((k) => (
            <li key={k.key}>
              <Link
                href={`/app/db/${encodeURIComponent(k.key)}`}
                className="bg-card hover:bg-accent flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Database className="text-muted-foreground size-4" />
                  {k.key}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {k.uses} note{k.uses === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

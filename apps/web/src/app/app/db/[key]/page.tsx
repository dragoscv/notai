import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { listNotesByPropertyKey, listPropertyKeys } from '@/server/actions/note-properties';
import { DatabaseTable } from '@/components/database/database-table';

export const metadata = { title: 'Database' };

interface PageProps {
  params: Promise<{ key: string }>;
}

export default async function DatabasePage({ params }: PageProps) {
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  const [projection, allKeys] = await Promise.all([
    listNotesByPropertyKey(decoded),
    listPropertyKeys(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/app/db"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        All databases
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{decoded}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {projection.rows.length} note{projection.rows.length === 1 ? '' : 's'} with this property.
      </p>
      <div className="mt-6">
        <DatabaseTable projection={projection} primaryKey={decoded} />
      </div>

      {allKeys.length > 1 && (
        <div className="mt-8">
          <h2 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Other databases
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {allKeys
              .filter((k) => k.key !== decoded)
              .slice(0, 30)
              .map((k) => (
                <Link
                  key={k.key}
                  href={`/app/db/${encodeURIComponent(k.key)}`}
                  className="bg-card hover:bg-accent rounded-full border px-2.5 py-1 text-xs"
                >
                  {k.key} <span className="text-muted-foreground">{k.uses}</span>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Hash, FileText, ChevronRight } from 'lucide-react';
import { auth } from '@/auth';
import { listNotesByTagPath, listChildTagSegments } from '@/server/actions/tags';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ name: string[] }>;
}

export default async function TagPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const { name } = await params;
  const segments = name.map(decodeURIComponent).filter(Boolean);
  const path = segments.join('/');
  const { tag, notes, includesDescendants } = await listNotesByTagPath(path);
  const children = await listChildTagSegments(path);
  if (!tag && children.length === 0) notFound();

  const ancestors: Array<{ label: string; href: string }> = segments.slice(0, -1).map((_, i) => ({
    label: segments[i]!,
    href:
      '/app/tags/' +
      segments
        .slice(0, i + 1)
        .map(encodeURIComponent)
        .join('/'),
  }));
  const leaf = segments[segments.length - 1] ?? path;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <nav
        className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
        aria-label="Tag breadcrumbs"
      >
        <Link href="/app" className="hover:underline">
          All
        </Link>
        {ancestors.map((a) => (
          <span key={a.href} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            <Link href={a.href} className="hover:underline">
              {a.label}
            </Link>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Hash className="text-muted-foreground size-5" />
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{leaf}</h1>
        <span className="text-muted-foreground ml-auto text-sm">
          {notes.length} note{notes.length === 1 ? '' : 's'}
          {includesDescendants ? ' (incl. sub-tags)' : ''}
        </span>
      </div>

      {children.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {children.map((c) => {
            const childPath = (path ? `${path}/` : '') + c.segment;
            const href = '/app/tags/' + childPath.split('/').map(encodeURIComponent).join('/');
            return (
              <Link
                key={c.segment}
                href={href}
                className="bg-muted hover:bg-muted/80 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              >
                <Hash className="size-3 opacity-60" />
                {c.segment}
                <span className="text-muted-foreground ml-1">{c.count}</span>
              </Link>
            );
          })}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notes carry this tag yet.</p>
      ) : (
        <ul className="bg-card divide-y rounded-2xl border">
          {notes.map((n) => (
            <li key={n.id}>
              <Link
                href={`/app/n/${n.id}`}
                className="hover:bg-muted flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="size-5 shrink-0 text-center">
                  {n.icon || <FileText className="size-4 opacity-60" />}
                </span>
                <span className="truncate font-medium">{n.title || 'Untitled'}</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {new Date(n.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

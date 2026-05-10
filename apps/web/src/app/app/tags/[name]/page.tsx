import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Hash, FileText } from 'lucide-react';
import { auth } from '@/auth';
import { listNotesByTagName } from '@/server/actions/tags';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ name: string }>;
}

export default async function TagPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const { tag, notes } = await listNotesByTagName(decoded);
  if (!tag) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Hash className="text-muted-foreground size-5" />
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{tag.name}</h1>
        <span className="text-muted-foreground ml-auto text-sm">
          {notes.length} note{notes.length === 1 ? '' : 's'}
        </span>
      </div>
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

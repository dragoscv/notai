import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicShare } from '@/server/actions/public-share';

export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

/**
 * Public read-only landing for any note whose owner has enabled a
 * share link. No auth, no chrome \u2014 just the title + plaintext mirror
 * rendered as a clean reading page.
 */
export default async function PublicNotePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const note = await getPublicShare(token);
  if (!note) notFound();

  return (
    <main className="bg-background min-h-dvh">
      <article className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10 border-b pb-6">
          <div className="text-muted-foreground mb-2 text-xs uppercase tracking-widest">
            Shared from Notai
          </div>
          <h1 className="font-serif text-4xl font-semibold">
            {note.icon ? <span className="mr-2">{note.icon}</span> : null}
            {note.title || 'Untitled'}
          </h1>
          <p className="text-muted-foreground mt-3 text-xs">
            Last updated {note.updatedAt.toLocaleString()}
          </p>
        </header>
        {note.plaintext.trim() ? (
          <pre className="whitespace-pre-wrap break-words font-serif text-base leading-relaxed">
            {note.plaintext}
          </pre>
        ) : (
          <p className="text-muted-foreground italic">This note has no text yet.</p>
        )}
        <footer className="text-muted-foreground mt-16 border-t pt-6 text-center text-xs">
          Made with{' '}
          <Link href="/" className="hover:text-foreground underline underline-offset-2">
            Notai
          </Link>
        </footer>
      </article>
    </main>
  );
}

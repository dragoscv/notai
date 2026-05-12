import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublicShare, getPublicShareGate } from '@/server/actions/public-share';
import { UnlockForm } from './unlock-form';

export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const note = await getPublicShare(token);
  if (!note) return { title: 'Note not found · Notai' };
  const title = note.title || 'Untitled';
  // Plaintext is the canonical mirror of the canvas, so it's safe to
  // pull a short excerpt straight from it for previews.
  const description = (note.plaintext || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const ogImage = `/p/${encodeURIComponent(token)}/opengraph-image`;
  return {
    title: `${title} · Notai`,
    description: description || 'A note shared from Notai.',
    openGraph: {
      title,
      description,
      type: 'article',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: { index: false, follow: false },
  };
}

/**
 * Public read-only landing for any note whose owner has enabled a
 * share link. No auth, no chrome \u2014 just the title + plaintext mirror
 * rendered as a clean reading page.
 */
export default async function PublicNotePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const gate = await getPublicShareGate(token);
  if (gate.kind === 'notFound') notFound();

  if (gate.kind === 'locked') {
    return (
      <main className="bg-background grid min-h-dvh place-items-center px-6">
        <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 shadow-sm">
          <div>
            <div className="text-muted-foreground mb-2 text-xs uppercase tracking-widest">
              Shared from Notai
            </div>
            <h1 className="font-serif text-2xl font-semibold">Password required</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              The owner has protected this note with a password.
            </p>
          </div>
          <UnlockForm token={token} />
        </div>
      </main>
    );
  }

  const note = gate.note;

  return (
    <main className="bg-background min-h-dvh">
      <article className="mx-auto max-w-2xl px-6 py-16">
        {note.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={note.imageUrl}
            alt=""
            className="bg-muted/30 mb-8 w-full rounded-lg border object-contain"
            loading="eager"
          />
        ) : null}
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

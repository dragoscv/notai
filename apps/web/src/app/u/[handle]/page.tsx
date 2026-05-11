import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db, users, notes, eq, and, desc } from '@notai/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  handle: string;
}

async function loadBlog(handleRaw: string) {
  const handle = handleRaw.trim().toLowerCase();
  if (!handle || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle)) return null;
  const [owner] = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.blogHandle, handle))
    .limit(1);
  if (!owner) return null;
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
      icon: notes.icon,
      publicShareToken: notes.publicShareToken,
      publicShareSlug: notes.publicShareSlug,
      publicShareExpiresAt: notes.publicShareExpiresAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.ownerId, owner.id),
        eq(notes.blogVisible, true),
        sql`${notes.publicShareToken} is not null`,
        sql`${notes.deletedAt} is null`,
      ),
    )
    .orderBy(desc(notes.updatedAt))
    .limit(100);
  const now = Date.now();
  const posts = rows.filter(
    (r) => !r.publicShareExpiresAt || r.publicShareExpiresAt.getTime() > now,
  );
  return { owner, posts };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadBlog(handle);
  if (!data) return { title: 'Blog not found · Notai' };
  const author = data.owner.name ?? handle;
  return {
    title: `${author} · Notai`,
    description: `Notes published by ${author}.`,
    alternates: {
      types: { 'application/rss+xml': `/u/${handle}/feed.xml` },
    },
    openGraph: { title: `${author} · Notai`, type: 'profile' },
  };
}

export default async function BlogIndexPage({ params }: { params: Promise<Params> }) {
  const { handle } = await params;
  const data = await loadBlog(handle);
  if (!data) notFound();
  const { owner, posts } = data;
  return (
    <main className="bg-background min-h-dvh">
      <article className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10 border-b pb-6">
          <div className="text-muted-foreground mb-2 text-xs uppercase tracking-widest">
            Notai blog
          </div>
          <h1 className="font-serif text-4xl font-semibold">{owner.name ?? handle}</h1>
          <p className="text-muted-foreground mt-3 text-xs">
            <Link
              href={`/u/${handle}/feed.xml`}
              className="hover:text-foreground underline underline-offset-2"
            >
              RSS
            </Link>{' '}
            · {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </header>
        {posts.length === 0 ? (
          <p className="text-muted-foreground italic">No public notes yet.</p>
        ) : (
          <ul className="space-y-8">
            {posts.map((p) => {
              const slug = p.publicShareSlug ?? p.publicShareToken!;
              const excerpt = (p.plaintext ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
              return (
                <li key={p.id} className="border-b pb-6 last:border-b-0">
                  <Link href={`/p/${encodeURIComponent(slug)}`} className="group block">
                    <h2 className="font-serif text-2xl font-semibold group-hover:underline">
                      {p.icon ? <span className="mr-2">{p.icon}</span> : null}
                      {p.title || 'Untitled'}
                    </h2>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {p.updatedAt.toLocaleDateString()}
                    </p>
                    {excerpt && (
                      <p className="text-foreground/80 mt-3 line-clamp-3 text-sm leading-relaxed">
                        {excerpt}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
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

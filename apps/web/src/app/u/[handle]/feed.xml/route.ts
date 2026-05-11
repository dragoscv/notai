import { db, users, notes, eq, and, desc } from '@notai/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  handle: string;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { handle: raw } = await params;
  const handle = (raw ?? '').trim().toLowerCase();
  if (!handle || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle)) {
    return new Response('Not found', { status: 404 });
  }
  const [owner] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.blogHandle, handle))
    .limit(1);
  if (!owner) return new Response('Not found', { status: 404 });

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
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
    .limit(50);

  const now = Date.now();
  const posts = rows.filter(
    (r) => !r.publicShareExpiresAt || r.publicShareExpiresAt.getTime() > now,
  );

  const base = process.env.NEXTAUTH_URL ?? 'https://notai.app';
  const author = owner.name ?? handle;
  const items = posts
    .map((p) => {
      const slug = p.publicShareSlug ?? p.publicShareToken!;
      const url = `${base}/p/${encodeURIComponent(slug)}`;
      const desc = (p.plaintext ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
      return `    <item>
      <title>${escapeXml(p.title || 'Untitled')}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${p.updatedAt.toUTCString()}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(author)} · Notai</title>
    <link>${escapeXml(`${base}/u/${handle}`)}</link>
    <atom:link href="${escapeXml(`${base}/u/${handle}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>Notes published by ${escapeXml(author)}.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

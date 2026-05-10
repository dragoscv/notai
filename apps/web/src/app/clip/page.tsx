import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, notes } from '@notai/db';

export const dynamic = 'force-dynamic';

interface SearchParams {
  url?: string;
  title?: string;
  selection?: string;
}

/**
 * Quick-clip landing page hit by the Notai bookmarklet. Reads `url`,
 * `title`, `selection` from the query string, creates a fresh note
 * pre-filled with the markdown of those values, then redirects to it.
 *
 * Auth is enforced server-side: an unauthenticated user is bounced
 * to /login with the same query string preserved.
 */
export default async function ClipLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    const qs = new URLSearchParams();
    if (params.url) qs.set('url', params.url);
    if (params.title) qs.set('title', params.title);
    if (params.selection) qs.set('selection', params.selection);
    redirect(`/login?callbackUrl=/clip?${qs.toString()}`);
  }

  const title = (params.title || params.url || 'Web clip').slice(0, 200);
  const lines: string[] = [];
  if (params.url) lines.push(`Source: ${params.url}`);
  if (params.selection) {
    lines.push('');
    lines.push(params.selection.slice(0, 8000));
  }
  const plaintext = lines.join('\n').trim();

  const inserted = await db
    .insert(notes)
    .values({
      ownerId: user.id,
      title,
      plaintext: plaintext,
      icon: '\ud83d\udd17',
    })
    .returning({ id: notes.id });
  const newId = inserted[0]?.id;
  if (!newId) redirect('/app');
  redirect(`/app/n/${newId}`);
}

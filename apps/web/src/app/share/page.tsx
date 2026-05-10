import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, notes } from '@notai/db';

export const dynamic = 'force-dynamic';

interface SearchParams {
  url?: string;
  title?: string;
  text?: string;
}

/**
 * PWA Web Share Target landing page. Triggered when the OS share
 * sheet sends data to Notai via the manifest's share_target. Creates
 * a new note pre-filled with the shared title/text/url, then sends
 * the user straight into it.
 */
export default async function SharePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    const qs = new URLSearchParams();
    if (params.url) qs.set('url', params.url);
    if (params.title) qs.set('title', params.title);
    if (params.text) qs.set('text', params.text);
    redirect(`/login?callbackUrl=/share?${qs.toString()}`);
  }

  const title = (params.title || params.text?.slice(0, 80) || params.url || 'Shared').slice(0, 200);
  const lines: string[] = [];
  if (params.url) lines.push(`Source: ${params.url}`);
  if (params.text) {
    lines.push('');
    lines.push(params.text.slice(0, 8000));
  }
  const plaintext = lines.join('\n').trim();

  const inserted = await db
    .insert(notes)
    .values({
      ownerId: user.id,
      title,
      plaintext,
      icon: '\ud83d\udce5',
    })
    .returning({ id: notes.id });
  const newId = inserted[0]?.id;
  if (!newId) redirect('/app');
  redirect(`/app/n/${newId}`);
}

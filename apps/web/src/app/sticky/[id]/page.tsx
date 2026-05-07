import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getNote } from '@/server/actions/notes';
import { signRealtimeToken } from '@notai/lib/jwt';
import { StickyWindow } from '@/components/note/sticky-window';

export const metadata = { title: 'Sticky' };

export default async function StickyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/sticky/${id}`);

  const note = await getNote(id);
  if (!note) notFound();

  const secret = process.env.HOCUSPOCUS_JWT_SECRET;
  if (!secret) throw new Error('HOCUSPOCUS_JWT_SECRET missing');

  const realtimeUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
  if (!realtimeUrl) throw new Error('NEXT_PUBLIC_HOCUSPOCUS_URL missing');

  const token = await signRealtimeToken(
    {
      sub: session.user.id,
      name: session.user.name ?? 'Anon',
      email: session.user.email ?? '',
      noteId: id,
      role: note.ownerId === session.user.id ? 'owner' : 'editor',
    },
    secret,
  );

  return (
    <StickyWindow
      note={note}
      token={token}
      realtimeUrl={realtimeUrl}
      user={{
        id: session.user.id,
        name: session.user.name ?? 'Anon',
      }}
    />
  );
}

import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getNote, touchNoteOpened } from '@/server/actions/notes';
import { NoteWorkspace } from '@/components/note/note-workspace';
import { NotePasswordGate } from '@/components/note/note-password-gate';
import { isNoteLocked, isNoteUnlockedForSession } from '@/server/actions/note-password';
import { signRealtimeToken } from '@notai/lib/jwt';

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const note = await getNote(id);
  if (!note) notFound();

  // Password gate \u2014 owner is also subject to the prompt so the lock is
  // meaningful even if their session cookie is stolen along with auth.
  if (await isNoteLocked(id)) {
    if (!(await isNoteUnlockedForSession(id))) {
      return <NotePasswordGate noteId={id} />;
    }
  }

  await touchNoteOpened(id);

  const secret = process.env.HOCUSPOCUS_JWT_SECRET;
  if (!secret) throw new Error('HOCUSPOCUS_JWT_SECRET missing');

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
    <NoteWorkspace
      note={note}
      token={token}
      realtimeUrl={process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!}
      user={{
        id: session.user.id,
        name: session.user.name ?? 'Anon',
        email: session.user.email ?? '',
        image: session.user.image ?? null,
      }}
    />
  );
}

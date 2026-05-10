import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createNote } from '@/server/actions/notes';
import { apiUpdateNote } from '@/server/notes-api';

/**
 * One-shot route hit by the desktop app's global hotkey (Ctrl/Cmd+Shift+N),
 * the tray menu's "New sticky note" item, and the Android share-sheet
 * (which routes here with `?shared=<text>`).
 */
export default async function QuickCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ shared?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/app/quick-capture');
  }
  const { shared } = await searchParams;
  const text = typeof shared === 'string' ? shared.slice(0, 8000) : '';
  const note = await createNote({ kind: 'sticky', title: 'Capture', icon: '\u26a1' });
  if (!note) redirect('/app');
  if (text) {
    await apiUpdateNote(session.user.id, { id: note.id, plaintext: text });
  }
  redirect(`/sticky/${note.id}?capture=1`);
}

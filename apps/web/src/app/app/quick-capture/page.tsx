import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createNote } from '@/server/actions/notes';

/**
 * One-shot route hit by the desktop app's global hotkey (Ctrl/Cmd+Shift+N)
 * and tray menu's "New sticky note" item. Creates a fresh sticky and
 * redirects into it. The caller window is small + always-on-top so the
 * user is typing within ~200ms of pressing the shortcut.
 */
export default async function QuickCapturePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/app/quick-capture');
  }
  const note = await createNote({ kind: 'sticky', title: 'Capture', icon: '⚡' });
  if (!note) redirect('/app');
  redirect(`/sticky/${note.id}?capture=1`);
}

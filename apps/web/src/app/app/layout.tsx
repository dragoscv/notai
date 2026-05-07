import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { AppShell } from '@/components/layout/app-shell';
import { listNotes } from '@/server/actions/notes';
import { listFolders } from '@/server/actions/folders';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [notes, folders] = await Promise.all([listNotes(), listFolders()]);

  return (
    <AppShell
      sidebar={<Sidebar user={session.user} notes={notes} folders={folders} />}
      commandPalette={<CommandPalette notes={notes} />}
    >
      {children}
    </AppShell>
  );
}

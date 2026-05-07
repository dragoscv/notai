import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { listNotes } from '@/server/actions/notes';
import { listFolders } from '@/server/actions/folders';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.id) redirect('/signin');

    const [notes, folders] = await Promise.all([listNotes(), listFolders()]);

    return (
        <div className="flex h-dvh w-full overflow-hidden bg-background">
            <Sidebar user={session.user} notes={notes} folders={folders} />
            <main className="relative flex min-w-0 flex-1 flex-col">{children}</main>
            <CommandPalette notes={notes} />
        </div>
    );
}

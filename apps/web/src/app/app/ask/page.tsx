import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AskClient } from '@/components/ask/ask-client';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';

export const dynamic = 'force-dynamic';

export default async function AskPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  return (
    <div className="flex h-full flex-col">
      <header
        className="bg-background/70 flex shrink-0 items-center gap-2 border-b px-4 py-2 backdrop-blur"
        data-focus-hide
      >
        <SidebarToggle />
        <h1 className="text-sm font-medium">Ask Notai</h1>
        <p className="text-muted-foreground hidden text-xs sm:inline">
          · search and reason across all your notes
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AskClient />
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { suggestFoldersForUnfiled } from '@/server/actions/inbox-zero';
import { InboxZeroClient } from '@/components/inbox-zero/inbox-zero-client';

export const metadata = { title: 'Inbox Zero — Notai' };

export default async function InboxZeroPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/inbox-zero');
  const items = await suggestFoldersForUnfiled();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Inbox Zero</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Notes you haven&apos;t filed yet. Notai suggests the closest folder by comparing each note
          to the average of every folder&apos;s contents. Accept the suggestion in one click — or
          pick your own.
        </p>
      </header>
      <InboxZeroClient initial={items} />
    </div>
  );
}

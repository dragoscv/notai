import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { suggestFoldersForUnfiled } from '@/server/actions/inbox-zero';
import { InboxZeroClient } from '@/components/inbox-zero/inbox-zero-client';

export async function generateMetadata() {
  const t = await getTranslations('pages.inboxZero');
  return { title: t('metaTitle') };
}

export default async function InboxZeroPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/inbox-zero');
  const items = await suggestFoldersForUnfiled();
  const t = await getTranslations('pages.inboxZero');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </header>
      <InboxZeroClient initial={items} />
    </div>
  );
}

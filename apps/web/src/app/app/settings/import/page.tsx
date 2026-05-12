import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { MarkdownImportButton } from '@/components/settings/markdown-import-button';

export async function generateMetadata() {
  const t = await getTranslations('settings.pages.import');
  return { title: t('title') };
}

export default async function ImportSettingsPage() {
  const t = await getTranslations('settings.pages.import');
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/import');
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('introPrefix')} <code>.md</code>{' '}
          {t('introSuffix', { title: 'title', icon: 'icon', emoji: 'emoji' })}
        </p>
      </div>
      <div className="bg-card rounded-2xl border p-6">
        <MarkdownImportButton />
        <p className="text-muted-foreground mt-3 text-xs">{t('limits')}</p>
      </div>

      <div className="bg-card space-y-3 rounded-2xl border p-6">
        <div>
          <h2 className="text-base font-medium">{t('exportHeading')}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('exportDescPrefix')}
            <code> {`{ path, content }`} </code>
            {t('exportDescSuffix')}
          </p>
        </div>
        <a
          href="/api/v1/export"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
        >
          {t('downloadNdjson')}
        </a>
      </div>
    </div>
  );
}

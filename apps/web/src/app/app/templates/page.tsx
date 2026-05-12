import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { listTemplates } from '@/server/actions/templates';
import { TemplatesGalleryClient } from './gallery-client';

export async function generateMetadata() {
  const t = await getTranslations('pages.templates');
  return { title: t('metaTitle') };
}

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/templates');
  const tpls = await listTemplates();
  const t = await getTranslations('pages.templates');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </header>

      <TemplatesGalleryClient templates={tpls} />

      <p className="text-muted-foreground pt-4 text-xs">
        <Link href="/app" className="underline">
          {t('backToNotes')}
        </Link>
      </p>
    </div>
  );
}

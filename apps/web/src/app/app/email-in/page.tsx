import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getOrCreateEmailAlias } from '@/server/actions/email-alias';
import { EmailAliasManager } from '@/components/settings/email-alias-manager';

export async function generateMetadata() {
  const t = await getTranslations('pages.emailIn');
  return { title: t('metaTitle') };
}

export default async function EmailInPage() {
  const alias = await getOrCreateEmailAlias();
  const t = await getTranslations('pages.emailIn');
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/app"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        {t('back')}
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t('description')}</p>

      {!alias.configured && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t.rich('notConfigured', {
            var: () => <code>EMAIL_INBOUND_DOMAIN</code>,
          })}
        </div>
      )}

      <div className="mt-6">
        <EmailAliasManager initial={alias} />
      </div>

      <details className="text-muted-foreground mt-8 text-xs">
        <summary className="cursor-pointer">{t('helpSummary')}</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            {t.rich('helpBullet1', {
              token: () => <code>+TOKEN</code>,
            })}
          </li>
          <li>{t('helpBullet2')}</li>
          <li>{t('helpBullet3')}</li>
        </ul>
      </details>
    </div>
  );
}

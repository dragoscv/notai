import { CalendarsManager } from '@/components/settings/calendars-manager';
import { listCalendarSubscriptions } from '@/server/actions/calendar-subs';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('pages.calendars');
  return { title: t('metaTitle') };
}

export default async function CalendarsPage() {
  const subs = await listCalendarSubscriptions();
  const t = await getTranslations('pages.calendars');
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
      <div className="mt-6">
        <CalendarsManager initial={subs} />
      </div>
      <details className="text-muted-foreground mt-8 text-xs">
        <summary className="cursor-pointer">{t('helpSummary')}</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <strong>{t('helpGoogleLabel')}</strong>
            {t('helpGoogleBody')}
          </li>
          <li>
            <strong>{t('helpOutlookLabel')}</strong>
            {t('helpOutlookBody')}
          </li>
          <li>
            <strong>{t('helpAppleLabel')}</strong>
            {t.rich('helpAppleBody', {
              webcal: () => <code>webcal://</code>,
              https: () => <code>https://</code>,
            })}
          </li>
        </ul>
      </details>
    </div>
  );
}

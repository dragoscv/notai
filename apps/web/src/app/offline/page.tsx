import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('system.offline');
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-static';

/**
 * Served by the service worker as a fallback when a navigation request
 * cannot be fulfilled (no network, no cached HTML). Local notes remain
 * available because they live in IndexedDB on the device.
 */
export default async function OfflinePage() {
  const t = await getTranslations('system.offline');
  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-primary text-xs font-semibold uppercase tracking-wider">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-4 text-pretty">{t('body')}</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/app">{t('openNotes')}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">{t('backToHome')}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

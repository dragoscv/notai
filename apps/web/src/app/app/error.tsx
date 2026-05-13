'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';

/**
 * In-shell error boundary for everything under /app. The root error.tsx
 * leans on the marketing aurora; here we keep the app frame so the user
 * stays oriented inside their workspace after a server-component crash.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('system.error');
  useEffect(() => {
    if (typeof console !== 'undefined') console.error(error);
  }, [error]);

  return (
    <div className="grid h-full w-full place-items-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="bg-destructive/10 text-destructive mx-auto mb-5 grid size-12 place-items-center rounded-full">
          <TriangleAlert className="size-6" />
        </div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {t('badge')}
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('body')}</p>
        {error.digest && (
          <p className="text-muted-foreground/70 mt-3 font-mono text-[11px]">
            {t('refLabel', { digest: error.digest })}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button size="sm" onClick={() => reset()}>
            <RefreshCw className="size-3.5" /> {t('retry')}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/app">
              <ArrowLeft className="size-3.5" /> {t('backToNotes')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

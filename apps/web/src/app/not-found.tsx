import Link from 'next/link';
import { ArrowLeft, Compass, PenLine, Pin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';

export async function generateMetadata() {
  const t = await getTranslations('system.notFound');
  return { title: t('metadataTitle') };
}

export default async function NotFound() {
  const t = await getTranslations('system.notFound');
  return (
    <div className="bg-background text-foreground relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      {/* aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-primary/20 absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl" />
        <div className="bg-sticky-pink/40 dark:bg-sticky-purple/30 absolute -right-32 top-[18rem] h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-50 dark:opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklab, var(--foreground) 18%, transparent) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)',
          }}
        />
      </div>

      <Link
        href="/"
        className="text-muted-foreground hover:bg-card/60 hover:text-foreground absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" /> {t('home')}
      </Link>

      <div className="relative mx-auto w-full max-w-2xl text-center">
        {/* Sticky note "404" */}
        <div className="relative mx-auto mb-10 h-44 w-72">
          <div className="bg-sticky-yellow shadow-foreground/10 absolute inset-0 rotate-[-6deg] rounded-xl p-5 shadow-xl">
            <div className="text-foreground/50 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
              <Pin className="size-3" /> {t('noteEyebrow')}
            </div>
            <div className="text-foreground/80 mt-1 font-serif text-7xl font-bold leading-none">
              404
            </div>
            <div className="text-foreground/70 mt-2 text-sm">{t('stickyBody')}</div>
          </div>
          <div className="bg-sticky-pink text-foreground/80 absolute -right-6 top-10 w-28 rotate-[10deg] rounded-md p-2.5 text-[11px] leading-snug shadow-md">
            <div className="text-foreground/50 text-[9px] font-medium uppercase tracking-wide">
              {t('todoEyebrow')}
            </div>
            {t('todoBody')}
          </div>
        </div>

        <p className="text-primary text-xs font-medium uppercase tracking-wider">{t('eyebrow')}</p>
        <h1 className="mt-3 text-balance font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md text-pretty">{t('body')}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
            <Link href="/app">
              <PenLine /> {t('openNotes')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/">
              <Compass /> {t('backToHome')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

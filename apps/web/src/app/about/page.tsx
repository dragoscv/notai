import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Heart, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/about' },
  };
}

export default async function AboutPage() {
  const session = await auth();
  const t = await getTranslations('about');
  const tHome = await getTranslations('home');
  const ctaHref = session?.user ? '/app' : '/signin';

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pb-12 pt-16 sm:pt-24">
          <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <MapPin className="text-primary size-3" />
            {t('badge')}
          </span>
          <h1 className="mt-5 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-6 text-pretty text-lg leading-relaxed">
            {t('intro')}
          </p>
        </section>

        <section className="mx-auto max-w-3xl space-y-12 px-6 py-12">
          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">{t('whatIsTitle')}</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">{t('whatIsBody')}</p>
          </div>

          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">
              {t('whatItIsNotTitle')}
            </h2>
            <ul className="text-muted-foreground mt-4 space-y-2 leading-relaxed">
              <li>— {t('whatItIsNot.notion')}</li>
              <li>— {t('whatItIsNot.wiki')}</li>
              <li>— {t('whatItIsNot.ai')}</li>
              <li>— {t('whatItIsNot.surveillance')}</li>
            </ul>
          </div>

          <div className="bg-card/60 rounded-2xl border p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-primary/15 text-primary grid size-10 place-items-center rounded-lg"
              >
                <ShieldCheck className="size-5" />
              </span>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                {t('whereTitle')}
              </h2>
            </div>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              {t('whereBody1Prefix')}
              <strong>{t('whereBody1Region')}</strong>
              {t('whereBody1Suffix')}
            </p>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {t('whereBody2Prefix')}
              <Link href="/docs/sync-and-storage" className="text-primary underline">
                {t('whereBody2Link')}
              </Link>
              {t('whereBody2Suffix')}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-primary/15 text-primary grid size-10 place-items-center rounded-lg"
              >
                <Heart className="size-5" />
              </span>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">{t('whyTitle')}</h2>
            </div>
            <p className="text-muted-foreground mt-4 leading-relaxed">{t('whyBody')}</p>
          </div>

          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">
              {t('operatorTitle')}
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              {t('operatorBodyPrefix')}
              <Link href="/contact" className="text-primary underline">
                {t('operatorBodyLink')}
              </Link>
              {t('operatorBodySuffix')}
            </p>
          </div>
        </section>

        <section className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            {t('ctaTitle')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">{t('ctaText')}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {session?.user ? tHome('ctaSignedIn') : tHome('ctaSignedOut')} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/features">
                <Sparkles className="size-4" />
                {t('seeFeatures')}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

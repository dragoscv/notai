import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Hammer, Lightbulb } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('roadmap');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/roadmap' },
  };
}

export const dynamic = 'force-static';

type ItemKey =
  | 'localFirst'
  | 'e2ee'
  | 'aiSearch'
  | 'billing'
  | 'clipper'
  | 'voice'
  | 'publicProfile'
  | 'webhooksShipped'
  | 'mobile'
  | 'stores'
  | 'daily'
  | 'i18n'
  | 'teams'
  | 'email'
  | 'calendar'
  | 'offlineAi'
  | 'sdk';

interface RoadmapColumn {
  status: 'shipped' | 'now' | 'next';
  items: ItemKey[];
}

const COLUMNS: RoadmapColumn[] = [
  {
    status: 'shipped',
    items: [
      'localFirst',
      'e2ee',
      'aiSearch',
      'billing',
      'clipper',
      'voice',
      'publicProfile',
      'webhooksShipped',
    ],
  },
  {
    status: 'now',
    items: ['mobile', 'stores', 'daily', 'i18n'],
  },
  {
    status: 'next',
    items: ['teams', 'email', 'calendar', 'offlineAi', 'sdk'],
  },
];

function StatusIcon({ status }: { status: RoadmapColumn['status'] }) {
  if (status === 'shipped') return <Check className="size-5 text-emerald-400" aria-hidden />;
  if (status === 'now') return <Hammer className="size-5 text-amber-400" aria-hidden />;
  return <Lightbulb className="size-5 text-sky-400" aria-hidden />;
}

export default async function RoadmapPage() {
  const session = await auth();
  const t = await getTranslations('roadmap');
  const tHome = await getTranslations('home');
  const ctaHref = session?.user ? '/app' : '/signin';

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pb-8 pt-16 sm:pt-20">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider">
            {t('kicker')}
          </p>
          <h1 className="mt-2 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-5 text-pretty text-lg">{t('subtitle')}</p>
          <p className="text-muted-foreground mt-3 text-sm">
            {t('askPrefix')}
            <a
              className="text-foreground underline underline-offset-4"
              href="https://github.com/dragoscv/notai/discussions/categories/ideas"
              target="_blank"
              rel="noopener"
            >
              {t('askGithub')}
            </a>
            {t('askMid')}
            <Link className="text-foreground underline underline-offset-4" href="/support/new">
              {t('askTicket')}
            </Link>
            {t('askSuffix')}
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid gap-6 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div
                key={col.status}
                className="border-border/60 bg-card/40 rounded-2xl border p-6 backdrop-blur"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon status={col.status} />
                  <h2 className="text-foreground text-sm font-semibold uppercase tracking-wider">
                    {t(`columns.${col.status}`)}
                  </h2>
                </div>
                <ul className="mt-5 space-y-5">
                  {col.items.map((key) => (
                    <li key={key}>
                      <p className="text-foreground text-sm font-medium leading-snug">
                        {t(`items.${key}.title`)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {t(`items.${key}.body`)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">{t('followTitle')}</h2>
          <p className="text-muted-foreground mt-4">
            {t('followPrefix')}
            <Link className="underline underline-offset-4" href="/changelog">
              {t('followLink')}
            </Link>
            {t('followSuffix')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {session?.user ? tHome('ctaSignedIn') : tHome('ctaSignedOut')} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a
                href="https://github.com/dragoscv/notai/discussions"
                target="_blank"
                rel="noopener"
              >
                {t('ghDiscussions')}
              </a>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

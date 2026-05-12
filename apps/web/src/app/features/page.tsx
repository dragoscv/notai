import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CloudOff,
  Command,
  FileText,
  Globe,
  Keyboard,
  Layers,
  Lock,
  Network,
  PenLine,
  Pin,
  Plug,
  Search,
  Sparkles,
  StickyNote,
  Tag,
  Users,
  Zap,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('features');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/features' },
  };
}

type Icon = React.ComponentType<{ className?: string }>;

interface PillarLayout {
  key: 'capture' | 'find' | 'sync' | 'dailyFlow' | 'developers';
  items: { key: string; icon: Icon }[];
}

const PILLAR_LAYOUT: PillarLayout[] = [
  {
    key: 'capture',
    items: [
      { key: 'pin', icon: Pin },
      { key: 'draw', icon: PenLine },
      { key: 'quick', icon: Command },
      { key: 'smartPaste', icon: StickyNote },
    ],
  },
  {
    key: 'find',
    items: [
      { key: 'palette', icon: Search },
      { key: 'ask', icon: Sparkles },
      { key: 'graph', icon: Network },
      { key: 'tags', icon: Tag },
    ],
  },
  {
    key: 'sync',
    items: [
      { key: 'offline', icon: CloudOff },
      { key: 'collab', icon: Users },
      { key: 'public', icon: Globe },
      { key: 'eu', icon: Lock },
    ],
  },
  {
    key: 'dailyFlow',
    items: [
      { key: 'today', icon: Zap },
      { key: 'pinned', icon: Layers },
      { key: 'kbd', icon: Keyboard },
      { key: 'export', icon: FileText },
    ],
  },
  {
    key: 'developers',
    items: [
      { key: 'rest', icon: Plug },
      { key: 'webhooks', icon: Network },
    ],
  },
];

export default async function FeaturesPage() {
  const session = await auth();
  const t = await getTranslations('features');
  const tHome = await getTranslations('home');
  const ctaHref = session?.user ? '/app' : '/signin';
  const ctaLabel = session?.user ? tHome('ctaSignedIn') : tHome('ctaSignedOut');

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-4xl px-6 pb-12 pt-12 text-center sm:pt-16">
          <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="text-primary size-3" />
            {t('badge')}
          </span>
          <h1 className="mt-5 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-pretty text-lg">
            {t('subtitle')}
          </p>
        </section>

        {PILLAR_LAYOUT.map((pillar, i) => (
          <section
            key={pillar.key}
            className={`mx-auto max-w-6xl px-6 py-16 ${i === 0 ? 'pt-8' : ''}`}
          >
            <header className="mb-10 max-w-2xl">
              <p className="text-primary text-xs font-semibold uppercase tracking-wider">
                {String(i + 1).padStart(2, '0')} · {t(`pillars.${pillar.key}.title`)}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                {t(`pillars.${pillar.key}.subtitle`)}
              </h2>
            </header>
            <ul className="grid gap-4 md:grid-cols-2">
              {pillar.items.map(({ icon: Icon, key }) => (
                <li
                  key={key}
                  className="bg-card/60 hover:border-primary/30 group relative overflow-hidden rounded-2xl border p-6 backdrop-blur transition"
                >
                  <div className="bg-primary/15 text-primary mb-4 inline-flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t(`pillars.${pillar.key}.${key}.title`)}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {t(`pillars.${pillar.key}.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            {t('readyTitle')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">{t('readyText')}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {ctaLabel} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/pricing">{t('seePricing')}</Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

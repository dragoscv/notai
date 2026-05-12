import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CloudOff,
  Command,
  Layers,
  PenLine,
  Pin,
  Sparkles,
  StickyNote,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import { AnalyticsConsent } from '@/components/analytics/analytics-consent';
import { JsonLd, SOFTWARE_APPLICATION_SCHEMA } from '@/components/seo/json-ld';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export default async function LandingPage() {
  const session = await auth();
  const t = await getTranslations('home');
  const ctaHref = session?.user ? '/app' : '/signin';
  const ctaLabel = session?.user ? t('ctaSignedIn') : t('ctaSignedOut');

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <JsonLd data={SOFTWARE_APPLICATION_SCHEMA} />
      <a href="#landing-main" className="a11y-skip-link">
        {t('skipLink')}
      </a>
      <AuroraBackground />

      <MarketingHeader signedIn={!!session?.user} />

      <main id="landing-main" className="relative">
        <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
        <BentoFeatures />
        <UseCases />
        <Testimonials />
        <FinalCta ctaHref={ctaHref} ctaLabel={ctaLabel} signedIn={!!session?.user} />
      </main>

      <MarketingFooter />
      <AnalyticsConsent />
    </div>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */

async function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  const t = await getTranslations('home.hero');
  const leading = t('titleLeading');
  // Split on \n to render line break in the title — translators preserve the newline.
  const [titlePart1, titlePart2] = leading.includes('\n') ? leading.split('\n') : [leading, ''];
  return (
    <section className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24">
      <div className="relative">
        <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
          <Sparkles className="text-primary size-3" />
          {t('badge')}
        </span>

        <h1 className="mt-5 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          {titlePart1}
          {titlePart2 ? <br /> : null}
          {titlePart2}
          <span className="relative inline-block">
            <span className="from-primary via-primary to-primary/60 bg-gradient-to-br bg-clip-text text-transparent">
              {t('titleHighlight')}
            </span>
            <UnderlineSquiggle className="text-primary/60 absolute -bottom-2 left-0 h-3 w-full" />
          </span>
          {t('titleTrailing')}
        </h1>

        <p className="text-muted-foreground mt-6 max-w-xl text-pretty text-lg">
          {t('description')}
        </p>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
            <Link href={ctaHref}>
              {ctaLabel} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <a href="#features">{t('secondaryCta')}</a>
          </Button>
        </div>

        <ul className="text-muted-foreground mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <li className="inline-flex items-center gap-1.5">
            <Check className="text-primary size-3.5" /> {t('bullets.noCard')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Check className="text-primary size-3.5" /> {t('bullets.offline')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Check className="text-primary size-3.5" /> {t('bullets.platforms')}
          </li>
        </ul>
      </div>

      <HeroMockup />
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto h-[28rem] w-full max-w-md sm:h-[30rem] lg:h-[34rem] lg:max-w-none">
      <div className="bg-primary/20 absolute inset-x-8 bottom-6 h-24 rounded-full blur-2xl" />

      {/* Today note — main card */}
      <div className="bg-card/95 shadow-foreground/10 absolute inset-x-4 top-8 rotate-[-2deg] rounded-2xl border p-5 shadow-xl backdrop-blur sm:inset-x-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary grid size-6 place-items-center rounded-md">
              <PenLine className="size-3.5" />
            </span>
            <span className="text-sm font-medium">Today</span>
          </div>
          <div className="flex -space-x-1.5">
            <span className="border-card bg-sticky-pink text-foreground/70 grid size-5 place-items-center rounded-full border-2 text-[9px] font-medium">
              A
            </span>
            <span className="border-card bg-sticky-blue text-foreground/70 grid size-5 place-items-center rounded-full border-2 text-[9px] font-medium">
              M
            </span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="font-serif text-xl font-semibold">Morning brief ☕</div>
          <Task done>Ship the new editor toolbar</Task>
          <Task done>Reply to design feedback</Task>
          <Task>Draft the Q3 roadmap</Task>
          <Task>
            Sketch onboarding flow{' '}
            <span className="bg-sticky-yellow text-foreground/70 ml-1 rounded-sm px-1 py-0.5 text-[10px] font-medium">
              ✏️ canvas
            </span>
          </Task>
          <Task>
            Read <span className="text-primary underline underline-offset-2">Deep Work, ch.4</span>
          </Task>
        </div>

        <svg viewBox="0 0 220 40" className="text-primary/70 mt-3 h-10 w-full" fill="none">
          <path
            d="M4 28 C 30 6, 60 38, 90 18 S 150 4, 180 24 S 215 14, 218 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Sticky notes around the main card */}
      <div className="bg-sticky-yellow text-foreground/80 shadow-foreground/10 absolute -left-2 top-2 w-44 rotate-[-8deg] rounded-md p-3 text-[13px] leading-snug shadow-lg sm:-left-4">
        <div className="text-foreground/50 mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
          <Pin className="size-3" /> pinned
        </div>
        Call mom on Sunday — don&apos;t forget the recipe!
      </div>

      <div className="bg-sticky-pink text-foreground/80 shadow-foreground/10 absolute -right-2 top-32 w-40 rotate-[6deg] rounded-md p-3 text-[13px] leading-snug shadow-lg sm:-right-4">
        <div className="text-foreground/50 mb-1 text-[10px] font-medium uppercase tracking-wide">
          Idea
        </div>
        &ldquo;What if focus mode dimmed everything except today?&rdquo;
      </div>

      <div className="bg-sticky-blue text-foreground/80 shadow-foreground/10 absolute -right-1 bottom-10 w-44 rotate-[-4deg] rounded-md p-3 text-[13px] leading-snug shadow-lg sm:-right-2">
        <div className="text-foreground/50 mb-1 text-[10px] font-medium uppercase tracking-wide">
          Grocery
        </div>
        <div>🥑 avocado · 🍞 sourdough</div>
        <div>☕ beans · 🧀 brie</div>
      </div>

      <div className="bg-sticky-green text-foreground/80 shadow-foreground/10 absolute -left-3 bottom-2 w-36 rotate-[5deg] rounded-md p-3 text-[13px] leading-snug shadow-lg">
        <div className="text-foreground/50 mb-1 text-[10px] font-medium uppercase tracking-wide">
          Workout
        </div>
        Tue · Thu · Sat — 30 min run 🏃
      </div>
    </div>
  );
}

function Task({ children, done = false }: { children: React.ReactNode; done?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={
          'mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-[3px] border ' +
          (done ? 'border-primary bg-primary text-primary-foreground' : 'border-border')
        }
      >
        {done && <Check className="size-2.5" />}
      </span>
      <span className={done ? 'text-muted-foreground line-through' : ''}>{children}</span>
    </div>
  );
}

function UnderlineSquiggle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 12"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M2 8 C 30 2, 60 12, 100 6 S 170 2, 198 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────────────── Bento features ─────────────────────── */

async function BentoFeatures() {
  const t = await getTranslations('home.bento');
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-primary text-xs font-medium uppercase tracking-wider">{t('eyebrow')}</p>
        <h2 className="mt-3 text-balance font-serif text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          {t('title')}
        </h2>
        <p className="text-muted-foreground mt-4">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:gap-5">
        <BentoCard className="md:col-span-3 md:row-span-2">
          <BentoHeader
            icon={<PenLine />}
            eyebrow={t('draw.eyebrow')}
            title={t('draw.title')}
            text={t('draw.text')}
          />
          <DrawingPreview />
        </BentoCard>

        <BentoCard className="md:col-span-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <BentoHeader
                icon={<StickyNote />}
                eyebrow={t('sticky.eyebrow')}
                title={t('sticky.title')}
                text={t('sticky.text')}
              />
            </div>
            <StickyPreview />
          </div>
        </BentoCard>

        <BentoCard className="md:col-span-3">
          <BentoHeader
            icon={<Users />}
            eyebrow={t('sync.eyebrow')}
            title={t('sync.title')}
            text={t('sync.text')}
          />
          <CursorsPreview />
        </BentoCard>

        <BentoCard className="md:col-span-2">
          <BentoMini
            icon={<CloudOff />}
            title={t('offlineFirst.title')}
            text={t('offlineFirst.text')}
          />
        </BentoCard>

        <BentoCard className="md:col-span-2">
          <BentoMini icon={<Zap />} title={t('speed.title')} text={t('speed.text')} />
        </BentoCard>

        <BentoCard className="md:col-span-2">
          <BentoMini
            icon={<Command />}
            title={t('keyboard.title')}
            text={
              <>
                {t('keyboard.tryPrefix')}{' '}
                <kbd className="bg-muted rounded border px-1 text-[10px]">⌘K</kbd>{' '}
                {t('keyboard.tryShortcut')}
              </>
            }
          />
        </BentoCard>
      </div>
    </section>
  );
}

function BentoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        'bg-card/70 hover:bg-card/90 group relative overflow-hidden rounded-2xl border p-6 backdrop-blur transition-colors ' +
        (className ?? '')
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
        style={{
          background:
            'radial-gradient(600px 200px at 0% 0%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 60%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function BentoHeader({
  icon,
  eyebrow,
  title,
  text,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <div className="text-primary mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
        <span className="bg-primary/15 grid size-6 place-items-center rounded-md [&_svg]:size-3.5">
          {icon}
        </span>
        {eyebrow}
      </div>
      <h3 className="text-balance font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h3>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">{text}</p>
    </div>
  );
}

function BentoMini({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: React.ReactNode;
}) {
  return (
    <div>
      <div className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg [&_svg]:size-4">
        {icon}
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{text}</p>
    </div>
  );
}

function DrawingPreview() {
  return (
    <div className="bg-background/60 relative mt-6 aspect-[16/10] w-full overflow-hidden rounded-xl border">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--foreground) 8%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 8%, transparent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <svg viewBox="0 0 480 300" className="absolute inset-0 h-full w-full" fill="none">
        <g
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M180 130 C 180 90, 220 70, 250 80 S 305 110, 295 150 C 290 170, 275 175, 270 195 L 230 195 C 225 175, 210 170, 205 155 Z" />
          <path d="M232 200 L 268 200" />
          <path d="M238 210 L 262 210" />
          <path d="M244 220 L 256 220" />
        </g>
        <g
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          className="text-foreground/80"
        >
          <path d="M70 80 C 75 70, 80 70, 80 90 L 80 110" />
          <circle cx="80" cy="68" r="2" fill="currentColor" />
          <path d="M100 95 C 100 80, 120 80, 120 95 C 120 110, 100 110, 100 95 Z" />
          <path d="M140 75 L 140 110 M140 95 C 150 85, 160 85, 160 95" />
          <path d="M180 75 L 180 110" />
          <path d="M200 90 C 200 80, 215 80, 215 95 L 215 110" />
        </g>
        <g stroke="oklch(0.65 0.18 50)" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M340 60 C 380 60, 420 100, 420 160 C 420 210, 380 240, 340 240 C 300 240, 270 220, 270 200" />
          <path d="M270 200 L 280 192 M270 200 L 280 208" />
        </g>
        <path
          d="M60 130 C 100 124, 160 138, 220 128"
          stroke="oklch(0.55 0.18 280)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </svg>

      <div className="bg-background/90 absolute bottom-3 right-3 flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm backdrop-blur">
        <span className="bg-primary size-3 rounded-full" />
        <span className="size-3 rounded-full" style={{ background: 'oklch(0.65 0.18 50)' }} />
        <span className="bg-foreground size-3 rounded-full" />
        <span className="bg-border mx-1 h-3 w-px" />
        <PenLine className="text-muted-foreground size-3.5" />
      </div>
    </div>
  );
}

function StickyPreview() {
  return (
    <div className="relative h-40 w-full sm:h-44 sm:w-56 sm:shrink-0">
      <div className="bg-sticky-yellow text-foreground/80 absolute right-2 top-1 w-32 rotate-[6deg] rounded-md p-2.5 text-[11px] leading-snug shadow-md">
        <div className="text-foreground/50 mb-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide">
          <Pin className="size-2.5" /> always
        </div>
        Stand-up at 10:00 — share the Q3 deck.
      </div>
      <div className="bg-sticky-pink text-foreground/80 absolute left-0 top-12 w-32 rotate-[-5deg] rounded-md p-2.5 text-[11px] leading-snug shadow-md">
        <div className="text-foreground/50 mb-1 text-[9px] font-medium uppercase tracking-wide">
          Today
        </div>
        Reply to Anna · Sketch onboarding flow.
      </div>
      <div className="bg-sticky-blue text-foreground/80 absolute bottom-1 right-1 w-32 rotate-[3deg] rounded-md p-2.5 text-[11px] leading-snug shadow-md">
        <div className="text-foreground/50 mb-1 text-[9px] font-medium uppercase tracking-wide">
          Bookmarks
        </div>
        Read · Watch later · Try this.
      </div>
    </div>
  );
}

function CursorsPreview() {
  return (
    <div className="bg-background/60 relative mt-6 overflow-hidden rounded-xl border p-5">
      <div className="space-y-2 text-sm">
        <div className="font-serif text-base font-semibold">Project Atlas — kickoff</div>
        <div className="text-muted-foreground">
          We agreed on{' '}
          <span className="relative">
            <span className="bg-sticky-yellow text-foreground/80 rounded-sm px-1">
              three milestones
            </span>
            <Cursor color="oklch(0.6 0.2 30)" name="Anna" className="-top-7 left-12" />
          </span>{' '}
          and a soft launch in{' '}
          <span className="relative">
            <span className="bg-sticky-blue text-foreground/80 rounded-sm px-1">late June</span>
            <Cursor color="oklch(0.6 0.2 240)" name="Marco" className="-top-7 right-2" />
          </span>
          .
        </div>
        <div className="text-muted-foreground">Owner rotation will follow next week.</div>
      </div>

      <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        3 collaborators online · synced just now
      </div>
    </div>
  );
}

function Cursor({ color, name, className }: { color: string; name: string; className?: string }) {
  return (
    <span className={'pointer-events-none absolute flex flex-col items-start ' + (className ?? '')}>
      <svg viewBox="0 0 16 16" className="size-3.5" fill={color}>
        <path d="M1 1 L 1 13 L 5 9 L 8 15 L 10 14 L 7 8 L 13 8 Z" />
      </svg>
      <span
        className="mt-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ background: color }}
      >
        {name}
      </span>
    </span>
  );
}

/* ─────────────────────── Use cases ─────────────────────── */

async function UseCases() {
  const t = await getTranslations('home.useCases');
  const items = [
    {
      tag: t('thinkers.tag'),
      quote: t('thinkers.quote'),
      author: t('thinkers.author'),
      color: 'bg-sticky-yellow',
    },
    {
      tag: t('students.tag'),
      quote: t('students.quote'),
      author: t('students.author'),
      color: 'bg-sticky-pink',
    },
    {
      tag: t('makers.tag'),
      quote: t('makers.quote'),
      author: t('makers.author'),
      color: 'bg-sticky-blue',
    },
  ];

  return (
    <section id="for-you" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-primary text-xs font-medium uppercase tracking-wider">{t('eyebrow')}</p>
        <h2 className="mt-3 text-balance font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {items.map((it) => (
          <figure key={it.tag} className="bg-card/70 relative rounded-2xl border p-6 backdrop-blur">
            <span
              className={`text-foreground/70 absolute -top-3 left-6 rounded-md px-2 py-0.5 text-[11px] font-medium shadow-sm ${it.color}`}
            >
              {it.tag}
            </span>
            <blockquote className="text-balance font-serif text-lg leading-snug">
              {it.quote}
            </blockquote>
            <figcaption className="text-muted-foreground mt-4 text-xs">{it.author}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────── Final CTA ─────────────────────── */

async function Testimonials() {
  const t = await getTranslations('home.testimonials');
  const quotes = [
    { q: t('q1.quote'), a: t('q1.author'), r: t('q1.role') },
    { q: t('q2.quote'), a: t('q2.author'), r: t('q2.role') },
    { q: t('q3.quote'), a: t('q3.author'), r: t('q3.role') },
  ];
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-10 text-center">
        <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
          <Sparkles className="text-primary size-3" /> {t('badge')}
        </span>
        <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {quotes.map((tq) => (
          <figure
            key={tq.a}
            className="bg-card/70 hover:shadow-foreground/5 rounded-2xl border p-6 backdrop-blur transition hover:shadow-md"
          >
            <blockquote className="text-foreground/90 text-sm leading-relaxed">
              &ldquo;{tq.q}&rdquo;
            </blockquote>
            <figcaption className="text-muted-foreground mt-4 text-xs">
              <span className="text-foreground font-medium">{tq.a}</span> — {tq.r}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function FinalCta({
  ctaHref,
  ctaLabel,
  signedIn,
}: {
  ctaHref: string;
  ctaLabel: string;
  signedIn: boolean;
}) {
  return <FinalCtaInner ctaHref={ctaHref} ctaLabel={ctaLabel} signedIn={signedIn} />;
}

async function FinalCtaInner({
  ctaHref,
  ctaLabel,
  signedIn,
}: {
  ctaHref: string;
  ctaLabel: string;
  signedIn: boolean;
}) {
  const t = await getTranslations('home.finalCta');
  const leading = t('titleLeading');
  const [titlePart1, titlePart2] = leading.includes('\n') ? leading.split('\n') : [leading, ''];
  return (
    <section id="start" className="relative mx-auto max-w-6xl px-6 pb-24">
      <div className="from-primary/15 via-card/80 to-sticky-pink/30 shadow-primary/10 dark:to-sticky-purple/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-10 text-center shadow-xl sm:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklab, var(--foreground) 16%, transparent) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse at 50% 50%, #000 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, #000 30%, transparent 75%)',
          }}
        />
        <div className="relative">
          <div className="bg-card/70 text-muted-foreground mx-auto mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <Layers className="text-primary size-3" />
            {t('badge')}
          </div>
          <h2 className="mx-auto max-w-2xl text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {titlePart1}
            {titlePart2 ? <br className="hidden sm:block" /> : null}
            {titlePart2}
            <span className="from-primary to-primary/60 bg-gradient-to-br bg-clip-text text-transparent">
              {t('titleHighlight')}
            </span>
            {t('titleTrailing')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-lg">{t('description')}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {ctaLabel} <ArrowRight />
              </Link>
            </Button>
            {!signedIn && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Wifi className="size-3.5" /> {t('offlineNote')}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

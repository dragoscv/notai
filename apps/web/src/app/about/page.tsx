import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Heart, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Notai is built solo in Romania, for ADHD and creative minds. Local-first, EU-hosted, no AI training on your notes — ever.',
  alternates: { canonical: '/about' },
};

export default async function AboutPage() {
  const session = await auth();
  const ctaHref = session?.user ? '/app' : '/signin';

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pb-12 pt-16 sm:pt-24">
          <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <MapPin className="text-primary size-3" />
            Made in Romania
          </span>
          <h1 className="mt-5 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            A calm place to think, built by one person.
          </h1>
          <p className="text-muted-foreground mt-6 text-pretty text-lg leading-relaxed">
            I built Notai because every notes app I tried was either too rigid (Notion), too noisy
            (Obsidian plugin soup), or too lossy (Apple Notes). I wanted something that respects
            ADHD brains: forgives interruptions, lets ideas land in any shape, and never punishes
            you for not having a system.
          </p>
        </section>

        <section className="mx-auto max-w-3xl space-y-12 px-6 py-12">
          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">What Notai is</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              A local-first notebook with sticky windows, drawings, real-time sync, and a small
              amount of AI for when you need it. Web, Windows, macOS, and a browser clipper today;
              mobile and Linux next.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">What Notai is not</h2>
            <ul className="text-muted-foreground mt-4 space-y-2 leading-relaxed">
              <li>— Not a Notion clone. No databases, no relations, no formula language.</li>
              <li>— Not a wiki. Hierarchy and tags exist, but they are optional.</li>
              <li>— Not an AI-first product. AI helps; it never gets in the way.</li>
              <li>— Not surveillance-ware. No analytics inside your notes, no AI training.</li>
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
                Where your notes live
              </h2>
            </div>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Hosted on Google Cloud in <strong>europe-west1</strong> (Belgium). PostgreSQL for
              metadata, encrypted Cloud Storage for attachments. Realtime collaboration runs on a
              dedicated Hocuspocus server. We never train AI models on your notes, never sell or
              share your data, and never embed analytics inside notes you write.
            </p>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              You can export everything as Markdown at any time, and you can fully delete your
              account from inside the app. See the{' '}
              <Link href="/docs/sync-and-storage" className="text-primary underline">
                sync, storage &amp; privacy
              </Link>{' '}
              doc for the full picture.
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
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                Why I am building this
              </h2>
            </div>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Calm, respectful software is rare. I want Notai to feel like a friend that quietly
              keeps your thoughts in order, not another tool that demands you adapt to its system.
              The rules are simple: capture must be instant, the editor must never lock you in, and
              your data must always be yours.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Operator</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Notai is operated by Vlăduțescu Dragoș Cătălin, persoană fizică, Romania.{' '}
              <Link href="/contact" className="text-primary underline">
                Get in touch
              </Link>{' '}
              for questions, partnerships, or feedback.
            </p>
          </div>
        </section>

        <section className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            Try the calm notebook
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            Free forever for personal use. No credit card. Works offline.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {session?.user ? 'Open your notes' : 'Get started — free'} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/features">
                <Sparkles className="size-4" />
                See features
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

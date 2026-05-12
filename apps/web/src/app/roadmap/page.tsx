import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Hammer, Lightbulb } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'What is shipping next in Notai. A small, opinionated plan — not a backlog dump.',
  alternates: { canonical: '/roadmap' },
};

export const dynamic = 'force-static';

interface RoadmapItem {
  title: string;
  body: string;
}
interface RoadmapColumn {
  status: 'shipped' | 'now' | 'next';
  label: string;
  items: RoadmapItem[];
}

/**
 * Hand-curated. Bias toward fewer, higher-confidence promises over a
 * giant wishlist. "Next" is genuinely planned for the next ~quarter,
 * not a backlog dump. Update this file when priorities change.
 */
const COLUMNS: RoadmapColumn[] = [
  {
    status: 'shipped',
    label: 'Shipped',
    items: [
      {
        title: 'Local-first notes + Excalidraw canvas',
        body: 'IndexedDB + Y.Doc + sticky windows on desktop.',
      },
      {
        title: 'Cloud sync (opt-in) with end-to-end encryption',
        body: 'PBKDF2-derived KEK, recovery key, encrypted titles.',
      },
      {
        title: 'AI search ("Ask my notes")',
        body: 'Vector embeddings over your notes, with RAG citations.',
      },
      { title: 'Stripe billing + dunning', body: 'Self-serve upgrade, downgrade, refund window.' },
      {
        title: 'Web clipper extension (Chrome / Edge / Firefox)',
        body: 'One-click save into Notai.',
      },
      {
        title: 'Voice-to-note quick capture',
        body: 'Whisper-on-the-server transcription with retry.',
      },
      {
        title: 'Public profile pages + RSS',
        body: '/u/[handle] surfaces published notes with a feed.',
      },
      {
        title: 'Webhooks (with signed delivery + replay)',
        body: 'note.created, note.updated, with HMAC + UI replay.',
      },
    ],
  },
  {
    status: 'now',
    label: 'In flight',
    items: [
      {
        title: 'Mobile (iOS + Android via Capacitor)',
        body: 'Beta build live; finishing share-sheet handlers and push parity.',
      },
      {
        title: 'Microsoft Store + Mac App Store',
        body: 'Signed installers ready; submitting after first paid customer.',
      },
      {
        title: 'Better daily flow ("Today" + journal)',
        body: 'Tightening the daily-note loop and review pages.',
      },
      { title: 'Romanian (RO) marketing translation', body: 'EN/RO toggle on the marketing site.' },
    ],
  },
  {
    status: 'next',
    label: 'Next up',
    items: [
      { title: 'Team workspaces', body: 'Shared notebooks with per-note access. Pricing addon.' },
      {
        title: 'Email-to-note (per-user inbox address)',
        body: 'Forward to a secret address; arrives as a new note.',
      },
      {
        title: 'Calendar capture',
        body: 'Pull today\u2019s events into the daily note automatically.',
      },
      {
        title: 'Offline AI fallback',
        body: 'Run search ranking on-device when the cloud is unreachable.',
      },
      {
        title: 'Public API + first-party SDK polish',
        body: '@notai/sdk goes 1.0 with typed actions and OAuth.',
      },
    ],
  },
];

function StatusIcon({ status }: { status: RoadmapColumn['status'] }) {
  if (status === 'shipped') return <Check className="size-5 text-emerald-400" aria-hidden />;
  if (status === 'now') return <Hammer className="size-5 text-amber-400" aria-hidden />;
  return <Lightbulb className="size-5 text-sky-400" aria-hidden />;
}

export default async function RoadmapPage() {
  const session = await auth();
  const ctaHref = session?.user ? '/app' : '/signin';

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pb-8 pt-16 sm:pt-20">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider">Roadmap</p>
          <h1 className="mt-2 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Small plan, kept honest.
          </h1>
          <p className="text-muted-foreground mt-5 text-pretty text-lg">
            What&rsquo;s shipped, what&rsquo;s in flight, and what&rsquo;s next. No giant backlog
            dumps &mdash; just the things we have real conviction about.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            Want something that&rsquo;s not here?{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href="https://github.com/dragoscv/notai/discussions/categories/ideas"
              target="_blank"
              rel="noopener"
            >
              Open a discussion on GitHub
            </a>{' '}
            or{' '}
            <Link className="text-foreground underline underline-offset-4" href="/support/new">
              file a ticket
            </Link>
            .
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
                    {col.label}
                  </h2>
                </div>
                <ul className="mt-5 space-y-5">
                  {col.items.map((item) => (
                    <li key={item.title}>
                      <p className="text-foreground text-sm font-medium leading-snug">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">
            Want to follow along?
          </h2>
          <p className="text-muted-foreground mt-4">
            The{' '}
            <Link className="underline underline-offset-4" href="/changelog">
              changelog
            </Link>{' '}
            is updated on every release.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {session?.user ? 'Open your notes' : 'Get started — free'} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a
                href="https://github.com/dragoscv/notai/discussions"
                target="_blank"
                rel="noopener"
              >
                GitHub Discussions
              </a>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

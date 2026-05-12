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
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Everything Notai does — sticky notes that float on top, drawings, AI search, real-time sync, daily notes, graph view, public pages, and a public REST API.',
  alternates: { canonical: '/features' },
};

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const PILLARS: { title: string; subtitle: string; items: Feature[] }[] = [
  {
    title: 'Capture',
    subtitle: 'Get the thought out of your head before it disappears.',
    items: [
      {
        icon: Pin,
        title: 'Sticky notes that float on top',
        body: 'Tiny windows that pin themselves above every other app. Perfect for snippets, todos, or the one thing you must remember during a call.',
      },
      {
        icon: PenLine,
        title: 'Draw, write, and type in one canvas',
        body: 'Powered by Excalidraw. Sketch a wireframe, write a paragraph, drop an image — there is no mode you have to pick first.',
      },
      {
        icon: Command,
        title: 'Quick capture, anywhere',
        body: 'Cmd / Ctrl + Shift + N from anywhere on your desktop drops a fresh sticky note. Voice-to-note works too.',
      },
      {
        icon: StickyNote,
        title: 'Smart paste',
        body: 'Paste a URL or transcript and Notai extracts the key points, tags, and a title for you.',
      },
    ],
  },
  {
    title: 'Find',
    subtitle: 'Notes are useless if you cannot find them.',
    items: [
      {
        icon: Search,
        title: 'Command palette (Ctrl + K)',
        body: 'Jump to any note, run any command, open any setting — never break flow with the mouse.',
      },
      {
        icon: Sparkles,
        title: 'Ask my notes',
        body: 'Semantic search + AI synthesis with citations. Stream answers in seconds, with links back to the source notes.',
      },
      {
        icon: Network,
        title: 'Graph view',
        body: 'See how notes link to each other. Click a node to jump in. Great for spotting orphans and rediscovering old ideas.',
      },
      {
        icon: Tag,
        title: 'Tags, folders, and backlinks',
        body: 'Use whichever organization feels right today. [[wiki-style]] links plus tag pages plus folders — never just one.',
      },
    ],
  },
  {
    title: 'Sync',
    subtitle: 'Local-first with optional cloud — never the other way around.',
    items: [
      {
        icon: CloudOff,
        title: 'Works offline from day one',
        body: 'Every change is local-first via Y.js CRDTs. When you reconnect, your edits and your collaborators’ edits merge cleanly.',
      },
      {
        icon: Users,
        title: 'Real-time collaboration',
        body: 'Share a note or a folder. Multiple cursors, presence, and zero merge conflicts. Powered by Hocuspocus on EU servers.',
      },
      {
        icon: Globe,
        title: 'Public pages',
        body: 'Publish any note as a beautiful read-only page at notai.ro/u/yourhandle. Share a link, no account required for readers.',
      },
      {
        icon: Lock,
        title: 'EU hosting, no AI training',
        body: 'Stored in europe-west1. We never train AI on your notes, never sell your data, and never run analytics inside your notes.',
      },
    ],
  },
  {
    title: 'Daily flow',
    subtitle: 'Built for ADHD and creative brains.',
    items: [
      {
        icon: Zap,
        title: 'Today’s note',
        body: 'A note that creates itself every morning. Open it with Ctrl+J. Write whatever — Notai will offer a gentle daily review at the end of the day.',
      },
      {
        icon: Layers,
        title: 'Pinned notes & version history',
        body: 'Pin the few notes that matter; everything else stays out of the way. Every save is a version you can roll back to.',
      },
      {
        icon: Keyboard,
        title: 'Keyboard-first, mouse-optional',
        body: 'Press ? anywhere for the live cheatsheet. The whole app can be driven from the keyboard.',
      },
      {
        icon: FileText,
        title: 'Bulk export to Markdown',
        body: 'Settings → Export your notes downloads a ZIP of every note. Your data is yours, always.',
      },
    ],
  },
  {
    title: 'For developers',
    subtitle: 'Build on top of your own notes.',
    items: [
      {
        icon: Plug,
        title: 'Public REST API',
        body: 'Read and write notes with personal access tokens. OpenAPI spec at /api/v1/openapi.',
      },
      {
        icon: Network,
        title: 'Webhooks',
        body: 'Subscribe to note.created, note.updated, and more. Signed with HMAC-SHA256, retried with backoff, replayable from the dashboard.',
      },
    ],
  },
];

export default async function FeaturesPage() {
  const session = await auth();
  const ctaHref = session?.user ? '/app' : '/signin';
  const ctaLabel = session?.user ? 'Open your notes' : 'Get started — free';

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-4xl px-6 pb-12 pt-12 text-center sm:pt-16">
          <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="text-primary size-3" />
            What is inside Notai
          </span>
          <h1 className="mt-5 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Every feature, organized by how you actually use them.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-pretty text-lg">
            Notai is one app split into four moments: capture, find, sync, daily flow. Pick a
            section below — or just scroll.
          </p>
        </section>

        {PILLARS.map((pillar, i) => (
          <section
            key={pillar.title}
            className={`mx-auto max-w-6xl px-6 py-16 ${i === 0 ? 'pt-8' : ''}`}
          >
            <header className="mb-10 max-w-2xl">
              <p className="text-primary text-xs font-semibold uppercase tracking-wider">
                {String(i + 1).padStart(2, '0')} · {pillar.title}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                {pillar.subtitle}
              </h2>
            </header>
            <ul className="grid gap-4 md:grid-cols-2">
              {pillar.items.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="bg-card/60 hover:border-primary/30 group relative overflow-hidden rounded-2xl border p-6 backdrop-blur transition"
                >
                  <div className="bg-primary/15 text-primary mb-4 inline-flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            Ready to try it?
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            Free forever for personal use. No credit card. Works offline.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {ctaLabel} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

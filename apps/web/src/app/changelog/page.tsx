import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'Notai release notes. Every shipped feature, fix, and improvement, organized by version.',
  alternates: { canonical: '/changelog' },
};

export const dynamic = 'force-static';
// Built once per deploy from CHANGELOG.md at the monorepo root; no
// runtime revalidation needed (the file only changes between deploys).
export const revalidate = false;

interface Section {
  heading: string;
  bullets: string[];
}
interface Release {
  version: string;
  date: string | undefined;
  sections: Section[];
}

/**
 * Minimal Keep-a-Changelog parser. Handles `## [Version]` / `## [Version] - DATE`
 * release headings, `### Section` group headings, and `- bullet` lines (joined
 * across continuation lines). Strips the prelude before the first release.
 */
function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let currentRelease: Release | null = null;
  let currentSection: Section | null = null;
  let buffer = '';

  const flushBuffer = () => {
    if (buffer && currentSection) currentSection.bullets.push(buffer.trim());
    buffer = '';
  };

  for (const line of md.split(/\r?\n/)) {
    const releaseMatch = /^##\s+\[([^\]]+)\](?:\s*[-–]\s*(\S+))?/.exec(line);
    if (releaseMatch && releaseMatch[1]) {
      flushBuffer();
      const release: Release = {
        version: releaseMatch[1],
        date: releaseMatch[2],
        sections: [],
      };
      currentRelease = release;
      currentSection = null;
      releases.push(release);
      continue;
    }

    if (!currentRelease) continue;

    const sectionMatch = /^###\s+(.+?)\s*$/.exec(line);
    if (sectionMatch && sectionMatch[1]) {
      flushBuffer();
      const section: Section = { heading: sectionMatch[1], bullets: [] };
      currentSection = section;
      currentRelease.sections.push(section);
      continue;
    }

    if (!currentSection) continue;

    const bulletMatch = /^\s*-\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushBuffer();
      buffer = bulletMatch[1] ?? '';
      continue;
    }

    if (buffer && line.trim()) {
      buffer += ' ' + line.trim();
    } else if (!line.trim()) {
      flushBuffer();
    }
  }
  flushBuffer();
  return releases;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ch === '&'
      ? '&amp;'
      : ch === '<'
        ? '&lt;'
        : ch === '>'
          ? '&gt;'
          : ch === '"'
            ? '&quot;'
            : '&#39;',
  );
}

/**
 * Render a small, safe subset of inline markdown to HTML:
 * **bold**, `code`, [text](url). Everything else is escaped.
 * Order matters: code first (no bold/link inside code), then links, then bold.
 */
function renderInline(src: string): string {
  const tokens: string[] = [];
  let rest = escapeHtml(src);

  // `code`
  rest = rest.replace(
    /`([^`]+)`/g,
    (_m, c) => `<code class="bg-muted rounded px-1 py-0.5 text-[0.85em] font-mono">${c}</code>`,
  );

  // [text](url)
  rest = rest.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => {
    const url = /^https?:\/\//.test(u) ? u : '#';
    return `<a href="${url}" class="text-primary underline">${t}</a>`;
  });

  // **bold**
  rest = rest.replace(
    /\*\*([^*]+)\*\*/g,
    (_m, c) => `<strong class="text-foreground">${c}</strong>`,
  );

  tokens.push(rest);
  return tokens.join('');
}

async function loadChangelog(): Promise<Release[]> {
  // CHANGELOG.md lives at the monorepo root. From apps/web at runtime the cwd
  // is apps/web, so resolve up two levels.
  const root = path.resolve(process.cwd(), '..', '..');
  const file = path.join(root, 'CHANGELOG.md');
  try {
    const md = await readFile(file, 'utf8');
    return parseChangelog(md);
  } catch {
    return [];
  }
}

export default async function ChangelogPage() {
  const [session, releases] = await Promise.all([auth(), loadChangelog()]);
  const ctaHref = session?.user ? '/app' : '/signin';

  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pb-8 pt-16 sm:pt-20">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider">Changelog</p>
          <h1 className="mt-2 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            What we shipped.
          </h1>
          <p className="text-muted-foreground mt-5 text-pretty text-lg">
            Every notable release, automatically generated from{' '}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">CHANGELOG.md</code>.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-16">
          {releases.length === 0 ? (
            <p className="text-muted-foreground">Changelog is being prepared.</p>
          ) : (
            <ol className="space-y-12">
              {releases.map((r) => (
                <li
                  key={r.version}
                  className="border-border/60 relative border-l-2 pl-6"
                  id={`v-${r.version.toLowerCase()}`}
                >
                  <span
                    aria-hidden
                    className="bg-primary absolute -left-[7px] top-2 size-3 rounded-full"
                  />
                  <header className="flex flex-wrap items-baseline gap-3">
                    <h2 className="font-serif text-3xl font-semibold tracking-tight">
                      {r.version}
                    </h2>
                    {r.date ? (
                      <time className="text-muted-foreground text-sm" dateTime={r.date}>
                        {r.date}
                      </time>
                    ) : null}
                  </header>

                  <div className="mt-4 space-y-6">
                    {r.sections.map((s) => (
                      <div key={s.heading}>
                        <h3 className="text-foreground text-sm font-semibold uppercase tracking-wider">
                          {s.heading}
                        </h3>
                        <ul className="text-muted-foreground mt-3 space-y-2 leading-relaxed">
                          {s.bullets.map((b, i) => (
                            <li
                              key={i}
                              className="before:bg-muted-foreground/40 relative pl-4 before:absolute before:left-0 before:top-2.5 before:size-1 before:rounded-full"
                              dangerouslySetInnerHTML={{ __html: renderInline(b) }}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="relative mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-muted-foreground">Want to follow along?</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/20 shadow-lg">
              <Link href={ctaHref}>
                {session?.user ? 'Open your notes' : 'Get started — free'} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/features">See features</Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

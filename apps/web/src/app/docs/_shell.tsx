import Link from 'next/link';
import { ArrowLeft, BookOpen, PenLine } from 'lucide-react';

interface DocsShellProps {
  /** Visible h1. */
  title: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** ISO date for "last updated". Omit on the index. */
  updated?: string;
  /** Optional reading-time minutes. */
  readingMinutes?: number;
  /** Body. */
  children: React.ReactNode;
}

/**
 * Shared shell for /docs and /docs/[slug]. Mirrors the LegalPage layout
 * for visual consistency with /privacy-policy, /terms, /faq.
 */
export function DocsShell({ title, subtitle, updated, readingMinutes, children }: DocsShellProps) {
  return (
    <div className="bg-background text-foreground relative min-h-dvh">
      <a
        href="#docs-main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="border-border/60 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
            aria-label="Notai home"
          >
            <span
              aria-hidden
              className="from-primary to-primary/70 text-primary-foreground shadow-primary/30 grid size-8 place-items-center rounded-lg bg-gradient-to-br shadow-sm"
            >
              <PenLine className="size-4" />
            </span>
            <span>Notai</span>
          </Link>
          <Link
            href="/docs"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All docs
          </Link>
        </div>
      </header>

      <main id="docs-main" className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <p className="text-primary inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide">
            <BookOpen className="size-3.5" aria-hidden />
            Docs
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-muted-foreground mt-3 text-lg">{subtitle}</p> : null}
          {updated || readingMinutes ? (
            <p className="text-muted-foreground mt-4 text-sm">
              {readingMinutes ? <span>{readingMinutes} min read</span> : null}
              {readingMinutes && updated ? <span aria-hidden> &middot; </span> : null}
              {updated ? (
                <>
                  Updated{' '}
                  <time dateTime={updated}>
                    {new Date(updated).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </>
              ) : null}
            </p>
          ) : null}
        </header>

        <article className="prose prose-zinc dark:prose-invert max-w-none">{children}</article>

        <footer className="border-border/60 mt-16 border-t pt-6">
          <p className="text-muted-foreground text-sm">
            Can&rsquo;t find what you need? Email{' '}
            <a href="mailto:hello@notai.ro" className="text-primary underline">
              hello@notai.ro
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

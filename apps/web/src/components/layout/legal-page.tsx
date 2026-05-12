import Link from 'next/link';
import { ArrowLeft, PenLine } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '../../../i18n';

interface LegalPageProps {
  /** Visible h1. */
  title: string;
  /** Subtitle shown under the title. */
  subtitle?: string;
  /** Last-updated date in ISO form (`YYYY-MM-DD`). */
  updated: string;
  /** Page body (markdown-style headings + paragraphs). */
  children: React.ReactNode;
}

/**
 * Shared shell for /privacy-policy, /terms, /contact, /cookies, /accessibility.
 * Provides a clean reading width, header, and footer with cross-links.
 */
export async function LegalPage({ title, subtitle, updated, children }: LegalPageProps) {
  const locale = await resolveLocale();
  const t = await getTranslations('legal.shell');
  const formattedDate = new Date(updated).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="bg-background text-foreground relative min-h-dvh">
      <a
        href="#legal-main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg"
      >
        {t('skipToContent')}
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
            href="/"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t('backHome')}
          </Link>
        </div>
      </header>

      <main id="legal-main" className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <p className="text-primary text-sm font-medium uppercase tracking-wide">{t('eyebrow')}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-muted-foreground mt-3 text-lg">{subtitle}</p> : null}
          <p className="text-muted-foreground mt-4 text-sm">
            {t('lastUpdated')} <time dateTime={updated}>{formattedDate}</time>
          </p>
        </header>

        <article className="legal-prose [&_a]:text-primary hover:[&_a]:text-primary/80 [&_h2]:text-foreground [&_h3]:text-foreground [&_p]:text-foreground/90 [&_ul]:text-foreground/90 [&_ol]:text-foreground/90 [&_strong]:text-foreground [&_code]:bg-muted max-w-none [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_li]:leading-relaxed [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:mt-4 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </article>
      </main>

      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
          <nav aria-label="Legal navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="hover:text-foreground" href="/docs">
              {t('nav.docs')}
            </Link>
            <Link className="hover:text-foreground" href="/faq">
              {t('nav.faq')}
            </Link>
            <Link className="hover:text-foreground" href="/support">
              {t('nav.support')}
            </Link>
            <Link className="hover:text-foreground" href="/privacy-policy">
              {t('nav.privacy')}
            </Link>
            <Link className="hover:text-foreground" href="/terms">
              {t('nav.terms')}
            </Link>
            <Link className="hover:text-foreground" href="/refund">
              {t('nav.refund')}
            </Link>
            <Link className="hover:text-foreground" href="/aup">
              {t('nav.aup')}
            </Link>
            <Link className="hover:text-foreground" href="/cookies">
              {t('nav.cookies')}
            </Link>
            <Link className="hover:text-foreground" href="/accessibility">
              {t('nav.accessibility')}
            </Link>
            <Link className="hover:text-foreground" href="/contact">
              {t('nav.contact')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { ArrowRight, PenLine } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { ThemeToggle } from '@notai/ui/components/theme-toggle';
import { getTranslations } from 'next-intl/server';
import { MarketingLocaleToggle } from './locale-toggle';

/**
 * Soft aurora + dot grid background used across the marketing site
 * (homepage, /features, /pricing, /about). Render once at the top of
 * the page tree.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="bg-primary/20 absolute -left-32 -top-40 h-[36rem] w-[36rem] rounded-full blur-3xl" />
      <div className="bg-sticky-pink/40 dark:bg-sticky-purple/30 absolute -right-40 top-[28rem] h-[32rem] w-[32rem] rounded-full blur-3xl" />
      <div className="bg-sticky-blue/30 dark:bg-sticky-blue/20 absolute left-1/2 top-[10rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full blur-3xl" />

      <div
        className="absolute inset-0 opacity-50 dark:opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklab, var(--foreground) 18%, transparent) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)',
        }}
      />
    </div>
  );
}

export async function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations('marketing.header');
  const navLinks: { href: string; label: string }[] = [
    { href: '/features', label: t('nav.features') },
    { href: '/pricing', label: t('nav.pricing') },
    { href: '/docs', label: t('nav.docs') },
    { href: '/about', label: t('nav.about') },
  ];
  return (
    <header className="relative z-20">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="from-primary to-primary/70 text-primary-foreground shadow-primary/30 grid size-8 place-items-center rounded-lg bg-gradient-to-br shadow-sm">
            <PenLine className="size-4" />
          </span>
          <span className="text-base">Notai</span>
        </Link>

        <div className="text-muted-foreground hidden items-center gap-7 text-sm md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <MarketingLocaleToggle />
          <ThemeToggle />
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/app">
                {t('openApp')} <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/signin">{t('signIn')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signin">{t('getStarted')}</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-foreground text-xs font-semibold uppercase tracking-wider">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted-foreground hover:text-foreground transition">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');
  const year = new Date().getFullYear();
  return (
    <footer className="relative mx-auto max-w-6xl px-6 pb-10">
      <div className="grid gap-8 border-t pt-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="bg-primary/15 text-primary grid size-6 place-items-center rounded-md"
            >
              <PenLine className="size-3.5" />
            </span>
            <span className="font-semibold tracking-tight">Notai</span>
          </div>
          <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
            {t('tagline')}
          </p>
          <p className="text-muted-foreground/80 mt-4 text-xs">{t('copyright', { year })}</p>
        </div>

        <FooterCol
          title={t('product')}
          links={[
            { href: '/', label: t('links.home') },
            { href: '/features', label: t('links.features') },
            { href: '/pricing', label: t('links.pricing') },
            { href: '/about', label: t('links.about') },
            { href: '/signin', label: t('links.signIn') },
          ]}
        />
        <FooterCol
          title={t('help')}
          links={[
            { href: '/docs', label: t('links.docs') },
            { href: '/changelog', label: t('links.changelog') },
            { href: '/roadmap', label: t('links.roadmap') },
            { href: '/faq', label: t('links.faq') },
            { href: '/support', label: t('links.myTickets') },
            { href: '/support/new', label: t('links.openTicket') },
            { href: '/contact', label: t('links.contact') },
          ]}
        />
        <FooterCol
          title={t('legal')}
          links={[
            { href: '/terms', label: t('links.terms') },
            { href: '/privacy-policy', label: t('links.privacy') },
            { href: '/refund', label: t('links.refund') },
            { href: '/aup', label: t('links.aup') },
            { href: '/cookies', label: t('links.cookies') },
            { href: '/accessibility', label: t('links.accessibility') },
          ]}
        />
      </div>
    </footer>
  );
}

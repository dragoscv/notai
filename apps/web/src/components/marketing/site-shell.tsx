import Link from 'next/link';
import { ArrowRight, PenLine } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { ThemeToggle } from '@notai/ui/components/theme-toggle';

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

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/about', label: 'About' },
];

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
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
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/app">
                Open app <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/signin">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signin">Get started</Link>
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

export function MarketingFooter() {
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
            A calm, local-first notes app with sticky windows, drawings, and optional cloud sync.
            Made with care in Romania.
          </p>
          <p className="text-muted-foreground/80 mt-4 text-xs">
            © {year} Notai · Operated by Vlăduțescu Dragoș Cătălin (PFA), Romania.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { href: '/', label: 'Home' },
            { href: '/features', label: 'Features' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/about', label: 'About' },
            { href: '/signin', label: 'Sign in' },
          ]}
        />
        <FooterCol
          title="Help"
          links={[
            { href: '/docs', label: 'Docs' },
            { href: '/faq', label: 'FAQ' },
            { href: '/support', label: 'My tickets' },
            { href: '/support/new', label: 'Open a ticket' },
            { href: '/contact', label: 'Contact' },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { href: '/terms', label: 'Terms' },
            { href: '/privacy-policy', label: 'Privacy' },
            { href: '/refund', label: 'Refund' },
            { href: '/aup', label: 'Acceptable use' },
            { href: '/cookies', label: 'Cookies' },
            { href: '/accessibility', label: 'Accessibility' },
          ]}
        />
      </div>
    </footer>
  );
}

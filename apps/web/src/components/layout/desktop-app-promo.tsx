'use client';
import * as React from 'react';
import { Download, Monitor, PenLine, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@notai/lib/utils';
import { isTauri } from '@/lib/tauri';
import { DESKTOP_DOWNLOAD_URL, hasLaunchedDesktop, launchDesktop } from '@/lib/desktop-app';

/**
 * Sidebar-footer promo for the desktop app.
 *
 * - Hidden entirely when already running inside Tauri.
 * - First-time: a small warm card pitching the desktop app + sticky notes.
 * - After the user has launched the app once: a compact "Open desktop app" pill.
 * - Collapsed sidebars get a single icon button in either case.
 */
export function DesktopAppPromo({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('appShell.desktopPromo');
  const [mounted, setMounted] = React.useState(false);
  const [launched, setLaunched] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setLaunched(hasLaunchedDesktop());
  }, []);

  if (!mounted) return null;
  if (isTauri()) return null;

  /* ── collapsed: icon-only ──────────────────────────────────────────── */
  if (collapsed) {
    if (launched) {
      return (
        <button
          type="button"
          onClick={() => launchDesktop()}
          title={t('openTitle')}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground mx-auto inline-flex size-8 items-center justify-center rounded-md transition-colors"
        >
          <Monitor className="size-4" />
        </button>
      );
    }
    return (
      <a
        href={DESKTOP_DOWNLOAD_URL}
        target="_blank"
        rel="noreferrer"
        title={t('getTitle')}
        className="bg-primary/10 text-primary hover:bg-primary/20 mx-auto inline-flex size-8 items-center justify-center rounded-md transition-colors"
      >
        <Download className="size-4" />
      </a>
    );
  }

  /* ── expanded: returning user — compact open button ───────────────── */
  if (launched) {
    return (
      <button
        type="button"
        onClick={() => launchDesktop()}
        className="bg-card/60 text-foreground/80 hover:bg-accent hover:text-accent-foreground group inline-flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm backdrop-blur transition-colors"
      >
        <span className="from-primary to-primary/70 text-primary-foreground shadow-primary/20 grid size-6 shrink-0 place-items-center rounded-md bg-gradient-to-br shadow-sm">
          <PenLine className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{t('openTitle')}</span>
        <Monitor className="text-muted-foreground group-hover:text-accent-foreground size-3.5 shrink-0 transition-colors" />
      </button>
    );
  }

  /* ── expanded: first-time — warm pitch card ──────────────────────── */
  return (
    <a
      href={DESKTOP_DOWNLOAD_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group relative block overflow-hidden rounded-xl border',
        'from-primary/15 via-card to-sticky-pink/30 dark:to-sticky-purple/30 bg-gradient-to-br',
        'hover:shadow-primary/15 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      {/* dotted texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklab, var(--foreground) 15%, transparent) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          maskImage: 'radial-gradient(ellipse at 100% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 100% 0%, #000 30%, transparent 80%)',
        }}
      />

      <div className="relative flex items-start gap-2.5">
        <span className="from-primary to-primary/70 text-primary-foreground shadow-primary/30 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-sm">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">{t('headline')}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{t('body')}</p>
        </div>
      </div>

      <div className="text-primary relative mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium">
        <Download className="size-3" /> {t('ctaFree')}
      </div>
    </a>
  );
}

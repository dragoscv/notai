'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'notai:install-prompt:dismissed-at';
const COOLDOWN_DAYS = 14;

/**
 * Lightweight PWA install nudge. We capture `beforeinstallprompt`,
 * sit on it, and surface a tiny banner only after the user has had
 * a chance to use the app for a few seconds. Dismissals are honoured
 * for two weeks so we don't nag.
 */
export function InstallPrompt() {
  const t = useTranslations('appShell.installPrompt');
  const [evt, setEvt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Already installed — nothing to do.
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    // Recently dismissed — sit out the cooldown.
    const last = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (last && Date.now() - last < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      // Delay a beat so the banner doesn't slam in during first paint.
      window.setTimeout(() => setVisible(true), 4_000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !evt) return null;

  return (
    <div className="bg-card text-card-foreground fixed bottom-24 left-1/2 z-40 flex w-[min(92vw,360px)] -translate-x-1/2 items-center gap-2 rounded-lg border p-3 shadow-lg md:bottom-6">
      <Download className="size-4 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{t('title')}</p>
        <p className="text-muted-foreground text-xs leading-tight">{t('description')}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await evt.prompt();
          await evt.userChoice.catch(() => undefined);
          window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
          setVisible(false);
        }}
        className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
      >
        {t('install')}
      </button>
      <button
        type="button"
        aria-label={t('dismissAria')}
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
          setVisible(false);
        }}
        className="hover:bg-muted rounded-md p-1"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

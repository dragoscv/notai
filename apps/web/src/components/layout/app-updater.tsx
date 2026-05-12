'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { isTauri, invoke } from '@/lib/tauri';
import { showUpdateAvailableToast, type UpdateInfo, type UpdateToastLabels } from './update-toast';

const POLL_MS = 60 * 60 * 1000; // re-check every hour while the app is open

/**
 * Mount-once component that wires up the auto-update flow:
 *
 * 1. **Tauri desktop**: never installs anything without consent. On mount
 *    (and every hour after) it asks the Rust side `check_for_update`. If a
 *    newer release exists, a sticky toast appears with the version and
 *    notes; clicking "Install & restart" invokes `install_update`, which
 *    downloads, applies, and restarts. The Rust startup task also emits
 *    `updater://available` on its own first check, so a notification can
 *    fire even if the user happened to be on a tab without this component.
 *
 * 2. **PWA (browser)**: when a freshly-activated service worker takes
 *    over, offer a Reload toast.
 */
export function AppUpdater() {
  const t = useTranslations('sidebarTree.updater');
  const labels = React.useMemo<UpdateToastLabels>(
    () => ({
      available: (version) => t('available', { version }),
      youAreOn: (current) => t('youAreOn', { current }),
      installRestart: t('installRestart'),
      downloading: t('downloading'),
      updateFailed: (error) => t('updateFailed', { error }),
      later: t('later'),
      upToDate: (current) => t('upToDate', { current }),
    }),
    [t],
  );
  React.useEffect(() => {
    if (isTauri()) {
      let cancelled = false;
      let unlisten: (() => void) | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;

      const runCheck = async () => {
        try {
          const info = await invoke<UpdateInfo | null>('check_for_update');
          if (cancelled || !info) return;
          showUpdateAvailableToast(info, labels);
        } catch {
          // offline, GitHub rate-limit, or command missing — silent.
        }
      };

      (async () => {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          const un = await listen<UpdateInfo>('updater://available', (ev) => {
            if (ev.payload) showUpdateAvailableToast(ev.payload, labels);
          });
          if (cancelled) un();
          else unlisten = un;
        } catch {
          /* tauri events not ready — ignore */
        }
        await runCheck();
        pollTimer = setInterval(runCheck, POLL_MS);
      })();

      return () => {
        cancelled = true;
        unlisten?.();
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    // Browser / PWA path.
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      toast(t('pwaUpdated'), {
        id: 'pwa-updated',
        duration: 10_000,
        action: {
          label: t('reload'),
          onClick: () => window.location.reload(),
        },
      });
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Nudge the browser to check for a new SW on mount. Serwist registers
    // the SW on its own; here we just trigger an update check so new
    // deploys propagate quickly when users keep the tab open.
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.update().catch(() => {
        /* ignore */
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [labels, t]);

  return null;
}

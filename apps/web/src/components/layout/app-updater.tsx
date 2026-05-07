'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { isTauri, invoke } from '@/lib/tauri';

/**
 * Mount-once component that wires up:
 *
 * 1. **Tauri desktop**: listens for `updater://ready` emitted by the Rust
 *    side after a silent background download+install. Shows a sonner toast
 *    with a "Restart now" action.
 *    Also proactively calls `check_for_update` on mount so the web layer
 *    acts as a retry if the event from startup fired before this listener
 *    was registered.
 *
 * 2. **PWA (browser)**: listens for `serviceWorker.controllerchange`, which
 *    fires when a freshly-activated service worker takes over the page.
 *    Shows a subtle toast offering to reload.
 */
export function AppUpdater() {
  React.useEffect(() => {
    if (isTauri()) {
      let unlisten: (() => void) | null = null;
      let cancelled = false;

      const showRestartToast = (version?: string) => {
        toast.success(
          version
            ? `Update installed (v${version}). Restart Notai to apply.`
            : 'Update installed. Restart Notai to apply.',
          {
            id: 'updater-ready',
            duration: Infinity,
            action: {
              label: 'Restart now',
              onClick: () => {
                invoke('restart_app').catch(() => {
                  /* ignore — app is quitting */
                });
              },
            },
          },
        );
      };

      (async () => {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          const un = await listen<{ version?: string }>('updater://ready', (ev) =>
            showRestartToast(ev.payload?.version),
          );
          if (cancelled) un();
          else unlisten = un;
        } catch {
          /* tauri not ready — ignore */
        }

        // Belt-and-suspenders: if the Rust-side startup check fired
        // before we subscribed, this second check picks up a staged
        // update (or no-ops if there isn't one).
        try {
          const applied = await invoke<boolean>('check_for_update');
          if (applied) showRestartToast();
        } catch {
          /* offline, no update, or command missing — ignore */
        }
      })();

      return () => {
        cancelled = true;
        unlisten?.();
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
      toast('Notai updated — reload to apply', {
        id: 'pwa-updated',
        duration: 10_000,
        action: {
          label: 'Reload',
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
  }, []);

  return null;
}

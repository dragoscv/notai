'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { isTauri } from '@/lib/tauri';

/**
 * Google sign-in button.
 *
 * In a normal browser it submits the parent `<form>` (server action → Auth.js).
 * In the Tauri desktop app it opens the system browser instead, because
 * Google blocks OAuth inside embedded WebView2.
 */
export function SignInGoogleButton({ children }: { children: ReactNode }) {
  // Use a ref + recheck on click so we always see the latest globals,
  // even if the click fires before useEffect has flushed.
  const desktopRef = useRef(false);
  useEffect(() => {
    desktopRef.current = isTauri();
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const inDesktop = desktopRef.current || isTauri();
    if (!inDesktop) return; // let the form submit normally
    e.preventDefault();

    const origin = window.location.origin;
    const target = `${origin}/desktop-signin?callbackUrl=${encodeURIComponent('/api/desktop-auth/issue')}`;

    // Try every available path to open the system browser. Log every
    // failure so users can copy a real error message instead of just
    // seeing "nothing happens".
    const attempts: Array<{ name: string; run: () => Promise<unknown> }> = [
      {
        name: 'plugin-opener.openUrl',
        run: async () => {
          const { openUrl } = await import('@tauri-apps/plugin-opener');
          return openUrl(target);
        },
      },
      {
        name: 'core.invoke(plugin:opener|open_url)',
        run: async () => {
          const { invoke } = await import('@tauri-apps/api/core');
          return invoke('plugin:opener|open_url', { url: target });
        },
      },
      {
        name: '__TAURI_INTERNALS__.invoke',
        run: async () => {
          type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
          const internals = (
            window as unknown as {
              __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
            }
          ).__TAURI_INTERNALS__;
          if (!internals?.invoke) throw new Error('no __TAURI_INTERNALS__.invoke');
          return internals.invoke('plugin:opener|open_url', { url: target });
        },
      },
    ];

    const errors: string[] = [];
    for (const attempt of attempts) {
      try {
        await attempt.run();
        return; // success
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${attempt.name}: ${msg}`);
        console.error(`[notai] sign-in opener "${attempt.name}" failed:`, err);
      }
    }

    toast.error('Could not open the system browser', {
      description:
        'Open this URL manually in your browser:\n' + target + '\n\n' + errors.join('\n'),
      duration: 20000,
    });
  };

  return (
    <Button type="submit" onClick={handleClick} className="w-full" size="lg" variant="outline">
      {children}
    </Button>
  );
}

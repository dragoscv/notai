'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import { isTauri } from '@/lib/tauri';

/**
 * Google sign-in button.
 *
 * In a normal browser it submits the parent `<form>` (server action → Auth.js).
 *
 * In the Tauri desktop app it uses a device-pairing flow: generate a random
 * device code, open the system browser at `/desktop-signin?device=<code>`,
 * then silently poll `/api/desktop-auth/poll?device=<code>` in the background
 * until the user finishes signing in. When the poll returns a handoff token
 * we navigate the webview to `/api/desktop-auth/consume?token=...` which
 * sets the session cookie and lands the user on `/app`.
 *
 * No `notai://` deep link, no "Open Notai?" browser dialog.
 */
export function SignInGoogleButton({ children }: { children: ReactNode }) {
  // Use a ref + recheck on click so we always see the latest globals,
  // even if the click fires before useEffect has flushed.
  const desktopRef = useRef(false);
  useEffect(() => {
    desktopRef.current = isTauri();
  }, []);

  const [waiting, setWaiting] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // Cancel any in-flight pairing on unmount.
  useEffect(() => () => cancelRef.current?.(), []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const inDesktop = desktopRef.current || isTauri();
    if (!inDesktop) return; // let the form submit normally
    e.preventDefault();
    if (waiting) return;

    const origin = window.location.origin;
    const device = generateDeviceCode();
    const target = `${origin}/desktop-signin?device=${encodeURIComponent(device)}`;

    const opened = await openInSystemBrowser(target);
    if (!opened.ok) {
      toast.error('Could not open the system browser', {
        description:
          'Open this URL manually in your browser:\n' + target + '\n\n' + opened.errors.join('\n'),
        duration: 20000,
      });
      return;
    }

    setWaiting(true);
    const dismiss = toast.loading('Waiting for sign-in…', {
      description: 'Finish signing in with Google in your browser.',
      duration: Infinity,
    });

    try {
      const handoff = await pollForHandoff(`${origin}/api/desktop-auth/poll`, device, {
        cancelRef,
        timeoutMs: 5 * 60 * 1000,
        intervalMs: 2500,
      });
      if (!handoff) return; // cancelled
      // Navigate the webview to /consume → sets cookie → redirects to /app.
      window.location.href = `${origin}/api/desktop-auth/consume?token=${encodeURIComponent(
        handoff,
      )}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Sign-in did not complete', { description: msg });
    } finally {
      toast.dismiss(dismiss);
      setWaiting(false);
      cancelRef.current = null;
    }
  };

  return (
    <Button
      type="submit"
      onClick={handleClick}
      className="w-full"
      size="lg"
      variant="outline"
      disabled={waiting}
    >
      {waiting ? (
        <>
          <Spinner className="size-4" /> Waiting for browser sign-in…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function generateDeviceCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url without padding
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function openInSystemBrowser(
  target: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
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
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${attempt.name}: ${msg}`);
      console.error(`[notai] sign-in opener "${attempt.name}" failed:`, err);
    }
  }
  return { ok: false, errors };
}

async function pollForHandoff(
  pollUrl: string,
  device: string,
  opts: {
    cancelRef: { current: (() => void) | null };
    timeoutMs: number;
    intervalMs: number;
  },
): Promise<string | null> {
  const deadline = Date.now() + opts.timeoutMs;
  let cancelled = false;
  let resolveSleep: (() => void) | null = null;

  opts.cancelRef.current = () => {
    cancelled = true;
    resolveSleep?.();
  };

  while (!cancelled && Date.now() < deadline) {
    const res = await fetch(`${pollUrl}?device=${encodeURIComponent(device)}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
    });

    if (res.status === 410) throw new Error('Sign-in expired. Please try again.');

    if (res.ok) {
      const data = (await res.json()) as { status: string; token?: string };
      if (data.status === 'ready' && data.token) return data.token;
    }

    await new Promise<void>((r) => {
      resolveSleep = r;
      setTimeout(r, opts.intervalMs);
    });
  }

  if (cancelled) return null;
  throw new Error('Sign-in timed out. Please try again.');
}

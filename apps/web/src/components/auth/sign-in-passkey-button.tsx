'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';

/**
 * "Sign in with passkey" — uses discoverable credentials so the user
 * picks the account from their authenticator. On success, the verify
 * route creates an Auth.js session cookie and we navigate to /app.
 */
export function SignInPasskeyButton({ callbackUrl }: { callbackUrl?: string }) {
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    try {
      const optsRes = await fetch('/api/auth/webauthn/login/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('Could not start passkey sign-in');
      const opts = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: opts });
      const verifyRes = await fetch('/api/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        const j = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Sign-in failed');
      }
      window.location.assign(callbackUrl && /^\/[^/]/.test(callbackUrl) ? callbackUrl : '/app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      if (/NotAllowed|cancel/i.test(msg)) return;
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={go} disabled={pending} className="w-full">
      {pending ? (
        <>
          <Spinner className="size-4" /> Waiting…
        </>
      ) : (
        <>
          <KeyRound className="size-4" /> Sign in with a passkey
        </>
      )}
    </Button>
  );
}

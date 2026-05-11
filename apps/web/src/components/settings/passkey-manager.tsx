'use client';

import { useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import { Plus, Trash2, KeyRound, Cloud, HardDrive } from 'lucide-react';
import { deletePasskey } from '@/server/actions/webauthn';

export interface PasskeyRow {
  id: string;
  label: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export function PasskeyManager({ initial }: { initial: PasskeyRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState(false);
  const [, startDel] = useTransition();

  async function enroll() {
    setPending(true);
    try {
      const optsRes = await fetch('/api/auth/webauthn/register/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('Could not start passkey registration');
      const opts = await optsRes.json();
      const label = window.prompt('Name this passkey (e.g. "MacBook Touch ID")', '');
      const att = await startRegistration({ optionsJSON: opts });
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: att, label: label?.trim() || null }),
      });
      if (!verifyRes.ok) {
        const j = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Registration failed');
      }
      toast.success('Passkey added');
      // Reload page-server data via a soft refresh; cheaper than refetching.
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      // User-cancelled WebAuthn surfaces as a NotAllowedError or similar.
      if (/NotAllowed|cancel/i.test(msg)) return;
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  function remove(id: string) {
    if (!window.confirm('Remove this passkey?')) return;
    startDel(async () => {
      const res = await deletePasskey(id);
      if (res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== id));
        toast.success('Passkey removed');
      } else {
        toast.error('Could not remove passkey');
      }
    });
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No passkeys yet. Add one to sign in faster on this device.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="bg-muted grid size-8 place-items-center rounded-md">
                {r.backedUp ? (
                  <Cloud className="size-4" aria-label="Synced passkey" />
                ) : (
                  <HardDrive className="size-4" aria-label="Device-bound passkey" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label ?? 'Unnamed passkey'}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {r.backedUp ? 'Synced' : 'This device'}
                  {r.transports ? ` · ${r.transports.replace(/,/g, ', ')}` : ''} · added{' '}
                  {new Date(r.createdAt).toLocaleDateString()}
                  {r.lastUsedAt
                    ? ` · last used ${new Date(r.lastUsedAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="text-muted-foreground hover:text-destructive rounded p-1.5"
                aria-label="Remove passkey"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={enroll} disabled={pending} variant="default">
        {pending ? (
          <>
            <Spinner className="size-4" /> Adding…
          </>
        ) : (
          <>
            <Plus className="size-4" /> Add a passkey
          </>
        )}
      </Button>
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <KeyRound className="mt-0.5 size-3.5 shrink-0" />
        Passkeys are stored on your device or password manager — Notai only sees the public key. You
        can sign in with any passkey from the sign-in page.
      </p>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings.passkeys');
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState(false);
  const [, startDel] = useTransition();

  async function enroll() {
    setPending(true);
    try {
      const optsRes = await fetch('/api/auth/webauthn/register/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error(t('couldNotStart'));
      const opts = await optsRes.json();
      const label = window.prompt(t('promptLabel'), '');
      const att = await startRegistration({ optionsJSON: opts });
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: att, label: label?.trim() || null }),
      });
      if (!verifyRes.ok) {
        const j = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t('registrationFailed'));
      }
      toast.success(t('added'));
      // Reload page-server data via a soft refresh; cheaper than refetching.
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('registrationFailed');
      // User-cancelled WebAuthn surfaces as a NotAllowedError or similar.
      if (/NotAllowed|cancel/i.test(msg)) return;
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  function remove(id: string) {
    if (!window.confirm(t('confirmRemove'))) return;
    startDel(async () => {
      const res = await deletePasskey(id);
      if (res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== id));
        toast.success(t('removed'));
      } else {
        toast.error(t('couldNotRemove'));
      }
    });
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="bg-muted grid size-8 place-items-center rounded-md">
                {r.backedUp ? (
                  <Cloud className="size-4" aria-label={t('syncedAria')} />
                ) : (
                  <HardDrive className="size-4" aria-label={t('deviceBoundAria')} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label ?? t('unnamed')}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {r.backedUp ? t('synced') : t('thisDevice')}
                  {r.transports ? ` · ${r.transports.replace(/,/g, ', ')}` : ''} ·{' '}
                  {t('addedOn', { date: new Date(r.createdAt).toLocaleDateString() })}
                  {r.lastUsedAt
                    ? ` · ${t('lastUsedOn', { date: new Date(r.lastUsedAt).toLocaleDateString() })}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="text-muted-foreground hover:text-destructive rounded p-1.5"
                aria-label={t('removeAria')}
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
            <Spinner className="size-4" /> {t('adding')}
          </>
        ) : (
          <>
            <Plus className="size-4" /> {t('addPasskey')}
          </>
        )}
      </Button>
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <KeyRound className="mt-0.5 size-3.5 shrink-0" />
        {t('footer')}
      </p>
    </div>
  );
}

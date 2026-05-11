'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Smartphone, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Spinner } from '@notai/ui/components/spinner';
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotpAction,
} from '@/server/actions/totp';

export interface TotpStatus {
  enrolled: boolean;
  enabledAt: string | null;
  remainingRecoveryCodes: number;
  lastUsedAt: string | null;
}

export function TotpManager({ initial }: { initial: TotpStatus }) {
  const [status, setStatus] = useState(initial);
  const [phase, setPhase] = useState<'idle' | 'enrolling' | 'codes' | 'disabling'>('idle');
  const [draft, setDraft] = useState<{ otpauthUrl: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const r = await beginTotpEnrollment();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDraft({ otpauthUrl: r.otpauthUrl, qrDataUrl: r.qrDataUrl });
      setPhase('enrolling');
    });
  }

  function confirm() {
    startTransition(async () => {
      const r = await confirmTotpEnrollment(code);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRecovery(r.recoveryCodes);
      setStatus({
        enrolled: true,
        enabledAt: new Date().toISOString(),
        remainingRecoveryCodes: r.recoveryCodes.length,
        lastUsedAt: new Date().toISOString(),
      });
      setCode('');
      setPhase('codes');
    });
  }

  function disable() {
    startTransition(async () => {
      const r = await disableTotpAction(code);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Two-factor disabled');
      setStatus({ enrolled: false, enabledAt: null, remainingRecoveryCodes: 0, lastUsedAt: null });
      setCode('');
      setPhase('idle');
    });
  }

  if (phase === 'codes' && recovery) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          <div>
            <strong>Save these recovery codes now.</strong> Each one can be used once if you lose
            your authenticator. They will not be shown again.
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {recovery.map((c) => (
            <li key={c} className="bg-muted rounded px-2.5 py-1.5">
              {c}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(recovery.join('\n'));
            toast.success('Copied');
          }}
        >
          Copy all
        </Button>
        <Button onClick={() => setPhase('idle')}>I&rsquo;ve saved them</Button>
      </div>
    );
  }

  if (phase === 'enrolling' && draft) {
    return (
      <div className="space-y-3 text-sm">
        <p>Scan with Google Authenticator, 1Password, Bitwarden, or any TOTP app:</p>
        <div className="bg-background inline-block rounded-lg border p-2">
          <Image src={draft.qrDataUrl} alt="TOTP QR code" width={240} height={240} unoptimized />
        </div>
        <p className="text-muted-foreground text-xs">
          Or enter the secret manually:{' '}
          <code className="bg-muted rounded px-1">
            {draft.otpauthUrl.split('secret=')[1]?.split('&')[0]}
          </code>
        </p>
        <label className="block">
          <span className="text-xs">Enter the 6-digit code from your app:</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-background mt-1 w-40 rounded-md border px-2.5 py-1.5 font-mono"
            placeholder="123456"
          />
        </label>
        <div className="flex gap-2">
          <Button onClick={confirm} disabled={pending || code.length < 6}>
            {pending ? <Spinner className="size-4" /> : null}
            Confirm
          </Button>
          <Button variant="outline" onClick={() => setPhase('idle')}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'disabling') {
    return (
      <div className="space-y-3 text-sm">
        <p>Enter your current 6-digit code (or a recovery code) to disable TOTP:</p>
        <input
          inputMode="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="bg-background w-44 rounded-md border px-2.5 py-1.5 font-mono"
          placeholder="123456"
        />
        <div className="flex gap-2">
          <Button variant="destructive" onClick={disable} disabled={pending || !code}>
            {pending ? <Spinner className="size-4" /> : null}
            Disable
          </Button>
          <Button variant="outline" onClick={() => setPhase('idle')}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (status.enrolled) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" /> Enabled
          {status.enabledAt ? (
            <span className="text-muted-foreground text-xs">
              · since {new Date(status.enabledAt).toLocaleDateString()}
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs">
          {status.remainingRecoveryCodes} recovery code
          {status.remainingRecoveryCodes === 1 ? '' : 's'} remaining
        </p>
        <Button variant="outline" onClick={() => setPhase('disabling')}>
          Disable two-factor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p>
        Add a TOTP authenticator app as a second factor. We&rsquo;ll require it for sensitive
        actions (account deletion, removing passkeys, billing changes).
      </p>
      <Button onClick={start} disabled={pending}>
        {pending ? <Spinner className="size-4" /> : <Smartphone className="size-4" />}
        Set up authenticator app
      </Button>
    </div>
  );
}

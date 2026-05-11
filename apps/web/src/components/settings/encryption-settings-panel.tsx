'use client';

import * as React from 'react';
import { Copy, Lock, Loader2, ShieldCheck, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui';
import {
  decryptBytes,
  deriveKEKFromPassphrase,
  encryptBytes,
  exportRawKey,
  fromB64,
  generateMasterKey,
  generateRecoveryKey,
  importRecoveryKEK,
  randomSalt,
} from '@/lib/e2e';
import { getMyKeyEnvelope, rotatePassphrase, setupEncryption } from '@/server/actions/encryption';
import { assessPassphrase, checkPassphraseBreached } from '@/lib/passphrase';

const STRENGTH_COLOR = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-emerald-500',
  'bg-emerald-600',
] as const;

function PassphraseStrengthMeter({ value }: { value: string }) {
  const strength = React.useMemo(() => assessPassphrase(value), [value]);
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="bg-muted h-1 w-full overflow-hidden rounded">
        <div
          className={`h-full transition-all ${STRENGTH_COLOR[strength.score]}`}
          style={{ width: `${((strength.score + 1) / 5) * 100}%` }}
        />
      </div>
      <p className="text-muted-foreground text-[11px]">
        <span className="font-medium capitalize">{strength.label}</span> · {strength.tip}
      </p>
    </div>
  );
}

type Status = 'loading' | 'not-setup' | 'configured';

/**
 * Settings panel that lets the user opt into per-note E2E encryption.
 * Generates a master key client-side, wraps it under both a
 * passphrase-derived KEK and a one-time recovery key, then ships the
 * two wrapped blobs to the server. The recovery key is shown ONCE.
 *
 * Per-note encrypt toggle ships in a follow-up — this panel is the
 * foundation: schema + key management + setup flow.
 */
export function EncryptionSettingsPanel() {
  const [status, setStatus] = React.useState<Status>('loading');
  const [pass1, setPass1] = React.useState('');
  const [pass2, setPass2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [recovery, setRecovery] = React.useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = React.useState(false);
  const [oldPass, setOldPass] = React.useState('');
  const [newPass1, setNewPass1] = React.useState('');
  const [newPass2, setNewPass2] = React.useState('');
  const [rotateBusy, setRotateBusy] = React.useState(false);

  React.useEffect(() => {
    void getMyKeyEnvelope().then((env) => {
      setStatus(env ? 'configured' : 'not-setup');
    });
  }, []);

  const onSetup = async () => {
    if (pass1.length < 12) {
      toast.error('Passphrase must be at least 12 characters');
      return;
    }
    if (pass1 !== pass2) {
      toast.error('Passphrases do not match');
      return;
    }
    const strength = assessPassphrase(pass1);
    if (strength.score < 2) {
      toast.error(`Passphrase too weak — ${strength.tip}`);
      return;
    }
    setBusy(true);
    try {
      const breached = await checkPassphraseBreached(pass1);
      if (breached && breached > 0) {
        toast.error(
          `This passphrase appeared in ${breached.toLocaleString()} known breaches. Pick something else.`,
        );
        setBusy(false);
        return;
      }
      const masterKey = await generateMasterKey();
      const rawMaster = await exportRawKey(masterKey);
      const salt = randomSalt(16);
      const KDF_ITERS = 600_000;

      const passKEK = await deriveKEKFromPassphrase(pass1, fromB64(salt), KDF_ITERS);
      const encryptedMasterKey = await encryptBytes(passKEK, rawMaster);

      const rec = generateRecoveryKey();
      const recoveryKEK = await importRecoveryKEK(rec.raw);
      const encryptedMasterKeyByRecovery = await encryptBytes(recoveryKEK, rawMaster);

      const res = await setupEncryption({
        salt,
        encryptedMasterKey,
        encryptedMasterKeyByRecovery,
        kdfIters: KDF_ITERS,
      });
      if (!res.ok) {
        toast.error('Encryption is already set up for this account');
        return;
      }
      setRecovery(rec.display);
      setStatus('configured');
      setPass1('');
      setPass2('');
      toast.success('Encryption enabled — save your recovery key now');
    } catch (err) {
      toast.error((err as Error).message ?? 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  const onRotate = async () => {
    if (newPass1.length < 12) {
      toast.error('New passphrase must be at least 12 characters');
      return;
    }
    if (newPass1 !== newPass2) {
      toast.error('New passphrases do not match');
      return;
    }
    const strength = assessPassphrase(newPass1);
    if (strength.score < 2) {
      toast.error(`New passphrase too weak — ${strength.tip}`);
      return;
    }
    setRotateBusy(true);
    try {
      const breached = await checkPassphraseBreached(newPass1);
      if (breached && breached > 0) {
        toast.error(
          `This passphrase appeared in ${breached.toLocaleString()} known breaches. Pick something else.`,
        );
        setRotateBusy(false);
        return;
      }
      const envelope = await getMyKeyEnvelope();
      if (!envelope) {
        toast.error('Encryption is not set up.');
        return;
      }
      const oldSalt = fromB64(envelope.salt);
      const oldKEK = await deriveKEKFromPassphrase(oldPass, oldSalt, envelope.kdfIters);
      let rawMaster: Uint8Array;
      try {
        rawMaster = await decryptBytes(oldKEK, envelope.encryptedMasterKey);
      } catch {
        toast.error('Current passphrase is wrong');
        return;
      }
      // Re-wrap master key with new salt + new passphrase.
      const newSalt = randomSalt(16);
      const newKEK = await deriveKEKFromPassphrase(newPass1, fromB64(newSalt), envelope.kdfIters);
      // importRawAesKey returns a CryptoKey but we already have the raw — encryptBytes works on raw.
      const newEncryptedMasterKey = await encryptBytes(newKEK, rawMaster);
      // Keep the recovery envelope as-is; master key didn't change.
      await rotatePassphrase({
        salt: newSalt,
        encryptedMasterKey: newEncryptedMasterKey,
        encryptedMasterKeyByRecovery: envelope.encryptedMasterKeyByRecovery,
        kdfIters: envelope.kdfIters,
      });
      toast.success('Passphrase changed');
      setRotateOpen(false);
      setOldPass('');
      setNewPass1('');
      setNewPass2('');
    } catch (err) {
      toast.error((err as Error).message ?? 'Rotation failed');
    } finally {
      setRotateBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Checking encryption status…
      </div>
    );
  }

  if (status === 'configured' && !recovery) {
    return (
      <div className="bg-card space-y-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" />
          <p className="font-medium">End-to-end encryption is enabled</p>
        </div>
        <p className="text-muted-foreground text-xs">
          You can mark individual notes as encrypted from the note menu. Server-side AI, search,
          sharing, and real-time collab are skipped for encrypted notes.
        </p>
        {!rotateOpen ? (
          <Button variant="outline" size="sm" onClick={() => setRotateOpen(true)}>
            <RefreshCcw className="size-4" /> Change passphrase
          </Button>
        ) : (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium">Change passphrase</p>
            <p className="text-muted-foreground text-xs">
              Your master key stays the same — we just re-wrap it under a new passphrase. Your
              recovery key continues to work unchanged.
            </p>
            <input
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              placeholder="Current passphrase"
              className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPass1}
              onChange={(e) => setNewPass1(e.target.value)}
              placeholder="New passphrase (12+ chars)"
              className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
              autoComplete="new-password"
            />
            <PassphraseStrengthMeter value={newPass1} />
            <input
              type="password"
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              placeholder="Confirm new passphrase"
              className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <Button
                onClick={onRotate}
                disabled={rotateBusy || !oldPass || !newPass1 || !newPass2}
              >
                {rotateBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
                Change passphrase
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRotateOpen(false);
                  setOldPass('');
                  setNewPass1('');
                  setNewPass2('');
                }}
                disabled={rotateBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (recovery) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="font-medium">
          Save this recovery key offline — it won&apos;t be shown again.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          If you forget your passphrase, this is the ONLY way to read your encrypted notes. Notai
          cannot recover it for you.
        </p>
        <div className="bg-background/80 mt-3 flex items-center gap-2 rounded-md p-2">
          <code className="flex-1 break-all font-mono text-xs">{recovery}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(recovery);
              toast.success('Recovery key copied');
            }}
            className="rounded-md border px-2 py-1 text-xs"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
        <Button className="mt-3" onClick={() => setRecovery(null)}>
          I&apos;ve saved it
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-4 text-sm">
      <div className="flex items-center gap-2">
        <Lock className="size-4" />
        <p className="font-medium">Enable end-to-end encryption</p>
      </div>
      <p className="text-muted-foreground text-xs">
        Generate a master key that lives only in your browser, wrapped by your passphrase. Once
        enabled, you can mark individual notes as encrypted; encrypted notes are excluded from
        server-side AI, search, sharing, and collaboration. Lose both the passphrase and the
        recovery key and the data is gone forever.
      </p>
      <input
        type="password"
        value={pass1}
        onChange={(e) => setPass1(e.target.value)}
        placeholder="Passphrase (12+ chars)"
        className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
        autoComplete="new-password"
      />
      <PassphraseStrengthMeter value={pass1} />
      <input
        type="password"
        value={pass2}
        onChange={(e) => setPass2(e.target.value)}
        placeholder="Confirm passphrase"
        className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
        autoComplete="new-password"
      />
      <Button onClick={onSetup} disabled={busy || !pass1 || !pass2}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        Enable encryption
      </Button>
    </div>
  );
}

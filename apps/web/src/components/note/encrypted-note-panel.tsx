'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Lock, Unlock, KeyRound, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@notai/ui/components/dialog';
import { Input } from '@notai/ui/components/input';
import {
  deriveKEKFromPassphrase,
  decryptBytes,
  encryptString,
  decryptString,
  importRawAesKey,
  importRecoveryKEK,
  parseRecoveryKey,
  fromB64,
} from '@/lib/e2e';
import { getMyKeyEnvelope } from '@/server/actions/encryption';
import {
  enableNoteEncryption,
  disableNoteEncryption,
  getNoteCiphertext,
} from '@/server/actions/note-encryption';

let cachedMasterKey: CryptoKey | null = null;
let unlockPromise: Promise<CryptoKey> | null = null;

/** Auto-relock after this many ms of no key use. 15 min default. */
const IDLE_RELOCK_MS = 15 * 60 * 1000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function bumpIdleTimer() {
  if (typeof window === 'undefined') return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    cachedMasterKey = null;
    idleTimer = null;
    try {
      toast.message('Locked your encrypted notes (idle)');
    } catch {
      // toast may not be mounted yet — harmless.
    }
  }, IDLE_RELOCK_MS);
}

export function getCachedMasterKey(): CryptoKey | null {
  if (cachedMasterKey) bumpIdleTimer();
  return cachedMasterKey;
}

export function clearCachedMasterKey(): void {
  cachedMasterKey = null;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export async function unlockMasterKey(passphrase: string): Promise<CryptoKey> {
  if (cachedMasterKey) return cachedMasterKey;
  const envelope = await getMyKeyEnvelope();
  if (!envelope) throw new Error('Encryption is not set up on this account.');
  const salt = fromB64(envelope.salt);
  const kek = await deriveKEKFromPassphrase(passphrase, salt, envelope.kdfIters);
  let raw: Uint8Array;
  try {
    raw = await decryptBytes(kek, envelope.encryptedMasterKey);
  } catch {
    throw new Error('Wrong passphrase.');
  }
  const master = await importRawAesKey(raw);
  cachedMasterKey = master;
  bumpIdleTimer();
  return master;
}

export async function unlockMasterKeyWithRecovery(recoveryDisplay: string): Promise<CryptoKey> {
  if (cachedMasterKey) return cachedMasterKey;
  const envelope = await getMyKeyEnvelope();
  if (!envelope) throw new Error('Encryption is not set up on this account.');
  let rawRecovery: Uint8Array;
  try {
    rawRecovery = parseRecoveryKey(recoveryDisplay);
  } catch {
    throw new Error('Could not parse recovery key.');
  }
  const kek = await importRecoveryKEK(rawRecovery);
  let raw: Uint8Array;
  try {
    raw = await decryptBytes(kek, envelope.encryptedMasterKeyByRecovery);
  } catch {
    throw new Error('Recovery key did not match.');
  }
  const master = await importRawAesKey(raw);
  cachedMasterKey = master;
  bumpIdleTimer();
  return master;
}

interface UnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (key: CryptoKey) => void;
  reason?: string;
}

export function UnlockKeyDialog({ open, onOpenChange, onUnlocked, reason }: UnlockDialogProps) {
  const [mode, setMode] = React.useState<'passphrase' | 'recovery'>('passphrase');
  const [passphrase, setPassphrase] = React.useState('');
  const [recoveryKey, setRecoveryKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setPassphrase('');
      setRecoveryKey('');
      setMode('passphrase');
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const promise =
        unlockPromise ??
        (mode === 'passphrase'
          ? unlockMasterKey(passphrase)
          : unlockMasterKeyWithRecovery(recoveryKey));
      unlockPromise = promise;
      const key = await promise;
      onUnlocked(key);
      onOpenChange(false);
      toast.success('Notes unlocked for this session');
    } catch (err) {
      toast.error((err as Error).message || 'Unlock failed');
    } finally {
      unlockPromise = null;
      setBusy(false);
    }
  };

  const canSubmit =
    mode === 'passphrase' ? passphrase.trim().length > 0 : recoveryKey.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Unlock encrypted notes
          </DialogTitle>
          <DialogDescription>
            {reason ??
              'Decryption happens entirely in your browser; the server never sees your key.'}
          </DialogDescription>
        </DialogHeader>
        {mode === 'passphrase' ? (
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Master passphrase"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        ) : (
          <Input
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="notai-rk-…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        )}
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
          onClick={() => setMode(mode === 'passphrase' ? 'recovery' : 'passphrase')}
          disabled={busy}
        >
          {mode === 'passphrase' ? 'Use recovery key instead' : 'Use passphrase instead'}
        </button>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}{' '}
            Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EncryptedNotePanel({ noteId, title }: { noteId: string; title: string }) {
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [decryptedTitle, setDecryptedTitle] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = React.useState(false);
  const [disabling, setDisabling] = React.useState(false);

  const tryDecrypt = React.useCallback(async () => {
    setError(null);
    const key = getCachedMasterKey();
    if (!key) {
      setUnlockOpen(true);
      return;
    }
    try {
      const ct = await getNoteCiphertext(noteId);
      if (ct == null) {
        setError('Could not fetch ciphertext.');
        return;
      }
      const text = ct.encryptedBody ? await decryptString(key, ct.encryptedBody) : '';
      setPlaintext(text);
      if (ct.encryptedTitle) {
        try {
          setDecryptedTitle(await decryptString(key, ct.encryptedTitle));
        } catch {
          // leave header showing the server placeholder
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Decryption failed');
    }
  }, [noteId]);

  React.useEffect(() => {
    void tryDecrypt();
  }, [tryDecrypt]);

  const turnOff = async () => {
    if (plaintext == null) return;
    if (
      !confirm('Disable encryption on this note? The plaintext will be stored on the server again.')
    ) {
      return;
    }
    setDisabling(true);
    try {
      await disableNoteEncryption({
        noteId,
        plaintext,
        plaintextTitle: decryptedTitle ?? undefined,
      });
      toast.success('Encryption disabled');
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message || 'Could not disable encryption');
    } finally {
      setDisabling(false);
    }
  };

  const displayTitle = decryptedTitle ?? title ?? 'Untitled';

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background/70 flex shrink-0 items-center gap-2 border-b px-4 py-2 backdrop-blur">
        <Lock className="text-primary size-4" />
        <span className="text-sm font-medium">End-to-end encrypted · read-only</span>
        <span className="text-muted-foreground ml-2 truncate text-sm">{displayTitle}</span>
        <div className="ml-auto flex items-center gap-2">
          {plaintext == null && (
            <Button size="sm" variant="outline" onClick={() => setUnlockOpen(true)}>
              <KeyRound className="size-3.5" /> Unlock
            </Button>
          )}
          {plaintext != null && (
            <Button size="sm" variant="outline" onClick={turnOff} disabled={disabling}>
              <Unlock className="size-3.5" /> Disable encryption
            </Button>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-8 py-6">
        {plaintext == null && error == null && (
          <div className="text-muted-foreground grid flex-1 place-items-center text-sm">
            <Loader2 className="size-4 animate-spin" /> Waiting for passphrase…
          </div>
        )}
        {error && (
          <div className="text-destructive flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4" /> {error}
          </div>
        )}
        {plaintext != null && (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{plaintext}</pre>
        )}
      </div>
      <UnlockKeyDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => void tryDecrypt()}
      />
    </div>
  );
}

export async function lockNoteFlow(
  noteId: string,
  plaintext: string,
  plaintextTitle?: string,
): Promise<boolean> {
  let key = getCachedMasterKey();
  if (!key) {
    const passphrase = window.prompt(
      'Enter your master passphrase to encrypt this note. Decryption happens entirely in your browser.',
    );
    if (!passphrase) return false;
    try {
      key = await unlockMasterKey(passphrase);
    } catch (err) {
      toast.error((err as Error).message || 'Unlock failed');
      return false;
    }
  }
  const blob = await encryptString(key, plaintext);
  const titleBlob =
    plaintextTitle && plaintextTitle.trim().length > 0
      ? await encryptString(key, plaintextTitle)
      : undefined;
  await enableNoteEncryption({ noteId, encryptedBody: blob, encryptedTitle: titleBlob });
  return true;
}
